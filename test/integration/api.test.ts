import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import type { Express } from "express";

import { createPool, closePool } from "../../src/infrastructure/db/pool";
import { runMigrations } from "../../src/infrastructure/db/migrate";
import { seed } from "../../src/infrastructure/db/seed";
import { createUnitOfWork } from "../../src/infrastructure/db/unitOfWork";
import { createLogger } from "../../src/infrastructure/logging/logger";
import { createServer } from "../../src/infrastructure/http/server";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/notifications_test";

let pool: Pool;
let app: Express;

beforeAll(async () => {
  pool = createPool(DATABASE_URL);
  await runMigrations(pool);
  await seed(pool);

  const uow = createUnitOfWork(pool);
  const logger = createLogger("silent");
  app = createServer({ uow, logger });
});

beforeEach(async () => {
  // Keep seeded catalog (default_preferences, global_policies) intact; only
  // reset per-user state so each test starts from a clean slate.
  await pool.query("truncate user_preferences, user_quiet_hours");
});

afterAll(async () => {
  await closePool(pool);
});

interface ResolvedPreferenceApi {
  notificationType: string;
  channel: string;
  enabled: boolean;
  source: string;
}

function findPref(
  body: { preferences: ResolvedPreferenceApi[] },
  notificationType: string,
  channel: string,
): ResolvedPreferenceApi | undefined {
  return body.preferences.find(
    (p) => p.notificationType === notificationType && p.channel === channel,
  );
}

describe("health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("scenario 1: default preferences for a new user", () => {
  it("returns the seeded defaults", async () => {
    const res = await request(app).get("/users/new-user/preferences");

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("new-user");
    expect(res.body.quietHours).toBeNull();

    const transactionalEmail = findPref(res.body, "transactional", "email");
    expect(transactionalEmail).toEqual({
      notificationType: "transactional",
      channel: "email",
      enabled: true,
      source: "default",
    });

    const marketingEmail = findPref(res.body, "marketing", "email");
    expect(marketingEmail).toEqual({
      notificationType: "marketing",
      channel: "email",
      enabled: false,
      source: "default",
    });
  });
});

describe("scenario 2: user changes their settings", () => {
  it("enables marketing/email and reflects source 'user' while keeping other defaults", async () => {
    const update = await request(app)
      .post("/users/u/preferences")
      .send({ preferences: [{ notificationType: "marketing", channel: "email", enabled: true }] });

    expect(update.status).toBe(200);

    const res = await request(app).get("/users/u/preferences");
    expect(res.status).toBe(200);

    const marketingEmail = findPref(res.body, "marketing", "email");
    expect(marketingEmail).toEqual({
      notificationType: "marketing",
      channel: "email",
      enabled: true,
      source: "user",
    });

    const transactionalEmail = findPref(res.body, "transactional", "email");
    expect(transactionalEmail?.enabled).toBe(true);
    expect(transactionalEmail?.source).toBe("default");
  });
});

describe("scenario 3: quiet hours effect", () => {
  beforeEach(async () => {
    await request(app)
      .post("/users/u/preferences")
      .send({
        preferences: [{ notificationType: "marketing", channel: "push", enabled: true }],
        quietHours: { timezone: "Europe/Berlin", start: "22:00", end: "08:00" },
      });
  });

  it("denies marketing/push inside quiet hours", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        userId: "u",
        notificationType: "marketing",
        channel: "push",
        region: "EU",
        datetime: "2026-05-21T21:30:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ decision: "deny", reason: "quiet_hours" });
  });

  it("allows marketing/push outside quiet hours", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        userId: "u",
        notificationType: "marketing",
        channel: "push",
        region: "EU",
        datetime: "2026-05-21T12:00:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ decision: "allow", reason: "allowed" });
  });

  it("allows transactional/push at night because it is exempt", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        userId: "u",
        notificationType: "transactional",
        channel: "push",
        region: "EU",
        datetime: "2026-05-21T21:30:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ decision: "allow", reason: "allowed" });
  });
});

describe("scenario 4: global policy effect", () => {
  it("denies marketing/sms in region EU due to the seeded policy", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        userId: "u",
        notificationType: "marketing",
        channel: "sms",
        region: "EU",
        datetime: "2026-05-21T12:00:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ decision: "deny", reason: "blocked_by_global_policy" });
  });
});

describe("scenario 5: idempotency of updates", () => {
  it("applying the same change twice yields identical results and a single row", async () => {
    const payload = {
      preferences: [{ notificationType: "marketing", channel: "email", enabled: false }],
    };

    const first = await request(app).post("/users/idem/preferences").send(payload);
    const second = await request(app).post("/users/idem/preferences").send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const { rows } = await pool.query<{ count: string }>(
      `select count(*)::text as count
         from user_preferences
        where user_id = $1 and notification_type = $2 and channel = $3`,
      ["idem", "marketing", "email"],
    );
    expect(rows[0]?.count).toBe("1");
  });
});

describe("validation", () => {
  it("returns 400 with an error code for a bad channel", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        userId: "u",
        notificationType: "marketing",
        channel: "carrier-pigeon",
        region: "EU",
        datetime: "2026-05-21T12:00:00Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});
