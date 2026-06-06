import { describe, it, expect } from "vitest";

import { evaluate, type EvaluationContext } from "../../src/domain/evaluation";
import type { DefaultPreference, UserPreference } from "../../src/domain/preferences";
import type { GlobalPolicy } from "../../src/domain/policy";
import type { QuietHours } from "../../src/domain/quietHours";
import { toRegion, type Channel, type NotificationType } from "../../src/domain/types";

function def(
  notificationType: NotificationType,
  channel: Channel,
  enabled: boolean,
): DefaultPreference {
  return { notificationType, channel, enabled };
}

function userPref(
  notificationType: NotificationType,
  channel: Channel,
  enabled: boolean,
): UserPreference {
  return {
    userId: "u1",
    notificationType,
    channel,
    enabled,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const emptyContext: EvaluationContext = {
  defaults: [],
  userOverrides: [],
  quietHours: null,
  policies: [],
};

describe("evaluate precedence", () => {
  it("denies when a global policy matches, even if the user enabled the channel", () => {
    const policy: GlobalPolicy = {
      id: "pol_eu_marketing_sms",
      notificationType: "marketing",
      channel: "sms",
      region: toRegion("EU"),
      reason: "eu_marketing_sms_restriction",
    };

    const context: EvaluationContext = {
      defaults: [def("marketing", "sms", true)],
      userOverrides: [userPref("marketing", "sms", true)],
      quietHours: null,
      policies: [policy],
    };

    const result = evaluate(
      {
        notificationType: "marketing",
        channel: "sms",
        region: toRegion("EU"),
        at: new Date("2026-05-21T12:00:00Z"),
      },
      context,
    );

    expect(result).toEqual({ decision: "deny", reason: "blocked_by_global_policy" });
  });

  it("denies with disabled_by_user when the user override turns the channel off", () => {
    const context: EvaluationContext = {
      ...emptyContext,
      defaults: [def("marketing", "email", true)],
      userOverrides: [userPref("marketing", "email", false)],
    };

    const result = evaluate(
      {
        notificationType: "marketing",
        channel: "email",
        region: toRegion("EU"),
        at: new Date("2026-05-21T12:00:00Z"),
      },
      context,
    );

    expect(result).toEqual({ decision: "deny", reason: "disabled_by_user" });
  });

  it("denies with disabled_by_default when only the default disables the channel", () => {
    const context: EvaluationContext = {
      ...emptyContext,
      defaults: [def("marketing", "email", false)],
    };

    const result = evaluate(
      {
        notificationType: "marketing",
        channel: "email",
        region: toRegion("US"),
        at: new Date("2026-05-21T12:00:00Z"),
      },
      context,
    );

    expect(result).toEqual({ decision: "deny", reason: "disabled_by_default" });
  });

  it("denies with not_configured when neither default nor override exists", () => {
    const result = evaluate(
      {
        notificationType: "marketing",
        channel: "messenger",
        region: toRegion("US"),
        at: new Date("2026-05-21T12:00:00Z"),
      },
      emptyContext,
    );

    expect(result).toEqual({ decision: "deny", reason: "not_configured" });
  });

  it("denies non-exempt types inside quiet hours", () => {
    const quietHours: QuietHours = {
      timezone: "Europe/Berlin",
      startMinute: 22 * 60,
      endMinute: 8 * 60,
    };

    const context: EvaluationContext = {
      defaults: [def("marketing", "push", true)],
      userOverrides: [],
      quietHours,
      policies: [],
    };

    // 21:30 UTC is 23:30 in Berlin (CEST), inside the 22:00 -> 08:00 window.
    const result = evaluate(
      {
        notificationType: "marketing",
        channel: "push",
        region: toRegion("EU"),
        at: new Date("2026-05-21T21:30:00Z"),
      },
      context,
    );

    expect(result).toEqual({ decision: "deny", reason: "quiet_hours" });
  });

  it("allows transactional and security types during quiet hours (exempt)", () => {
    const quietHours: QuietHours = {
      timezone: "Europe/Berlin",
      startMinute: 22 * 60,
      endMinute: 8 * 60,
    };

    const context: EvaluationContext = {
      defaults: [def("transactional", "push", true), def("security", "push", true)],
      userOverrides: [],
      quietHours,
      policies: [],
    };

    const at = new Date("2026-05-21T21:30:00Z");

    expect(
      evaluate({ notificationType: "transactional", channel: "push", region: toRegion("EU"), at }, context),
    ).toEqual({ decision: "allow", reason: "allowed" });

    expect(
      evaluate({ notificationType: "security", channel: "push", region: toRegion("EU"), at }, context),
    ).toEqual({ decision: "allow", reason: "allowed" });
  });

  it("allows when nothing blocks and the channel is enabled", () => {
    const context: EvaluationContext = {
      ...emptyContext,
      defaults: [def("transactional", "email", true)],
    };

    const result = evaluate(
      {
        notificationType: "transactional",
        channel: "email",
        region: toRegion("US"),
        at: new Date("2026-05-21T12:00:00Z"),
      },
      context,
    );

    expect(result).toEqual({ decision: "allow", reason: "allowed" });
  });
});
