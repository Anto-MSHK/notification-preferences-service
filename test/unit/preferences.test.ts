import { describe, it, expect } from "vitest";

import {
  resolvePreferences,
  resolveSingle,
  type DefaultPreference,
  type UserPreference,
} from "../../src/domain/preferences";
import type { Channel, NotificationType } from "../../src/domain/types";

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

describe("resolvePreferences", () => {
  it("merges user overrides over defaults and marks the source", () => {
    const defaults = [
      def("marketing", "email", false),
      def("transactional", "email", true),
    ];
    const overrides = [userPref("marketing", "email", true)];

    const resolved = resolvePreferences(defaults, overrides);

    const marketing = resolved.find(
      (p) => p.notificationType === "marketing" && p.channel === "email",
    );
    const transactional = resolved.find(
      (p) => p.notificationType === "transactional" && p.channel === "email",
    );

    expect(marketing).toEqual({
      notificationType: "marketing",
      channel: "email",
      enabled: true,
      source: "user",
    });
    expect(transactional).toEqual({
      notificationType: "transactional",
      channel: "email",
      enabled: true,
      source: "default",
    });
  });

  it("keeps a stable count equal to the defaults when overrides match existing keys", () => {
    const defaults = [def("marketing", "email", false), def("marketing", "sms", false)];
    const overrides = [userPref("marketing", "email", true)];

    expect(resolvePreferences(defaults, overrides)).toHaveLength(2);
  });

  it("appends user overrides that have no matching default", () => {
    const defaults = [def("marketing", "email", false)];
    const overrides = [userPref("promotional", "push", true)];

    const resolved = resolvePreferences(defaults, overrides);
    expect(resolved).toHaveLength(2);

    const extra = resolved.find(
      (p) => p.notificationType === "promotional" && p.channel === "push",
    );
    expect(extra).toEqual({
      notificationType: "promotional",
      channel: "push",
      enabled: true,
      source: "user",
    });
  });
});

describe("resolveSingle", () => {
  const defaults = [def("marketing", "email", false)];

  it("returns the user override when present", () => {
    const overrides = [userPref("marketing", "email", true)];
    expect(
      resolveSingle({ notificationType: "marketing", channel: "email" }, defaults, overrides),
    ).toEqual({
      notificationType: "marketing",
      channel: "email",
      enabled: true,
      source: "user",
    });
  });

  it("falls back to the default when there is no override", () => {
    expect(
      resolveSingle({ notificationType: "marketing", channel: "email" }, defaults, []),
    ).toEqual({
      notificationType: "marketing",
      channel: "email",
      enabled: false,
      source: "default",
    });
  });

  it("returns an unset, disabled preference when neither exists", () => {
    expect(
      resolveSingle({ notificationType: "system", channel: "messenger" }, defaults, []),
    ).toEqual({
      notificationType: "system",
      channel: "messenger",
      enabled: false,
      source: "unset",
    });
  });
});
