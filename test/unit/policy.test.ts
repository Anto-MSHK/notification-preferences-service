import { describe, it, expect } from "vitest";

import {
  findBlockingPolicy,
  policyMatches,
  type GlobalPolicy,
  type PolicyTarget,
} from "../../src/domain/policy";
import { toRegion } from "../../src/domain/types";

const target: PolicyTarget = {
  notificationType: "marketing",
  channel: "sms",
  region: toRegion("EU"),
};

function policy(overrides: Partial<GlobalPolicy>): GlobalPolicy {
  return {
    id: "pol",
    notificationType: null,
    channel: null,
    region: null,
    reason: "test",
    ...overrides,
  };
}

describe("policyMatches", () => {
  it("matches an exact policy", () => {
    expect(
      policyMatches(
        policy({ notificationType: "marketing", channel: "sms", region: toRegion("EU") }),
        target,
      ),
    ).toBe(true);
  });

  it("treats null fields as wildcards", () => {
    // A fully-null policy blocks everything.
    expect(policyMatches(policy({}), target)).toBe(true);
    // Wildcard type, specific channel + region.
    expect(
      policyMatches(policy({ channel: "sms", region: toRegion("EU") }), target),
    ).toBe(true);
    // Wildcard region, specific type + channel.
    expect(
      policyMatches(policy({ notificationType: "marketing", channel: "sms" }), target),
    ).toBe(true);
  });

  it("does not match when a concrete field differs", () => {
    expect(policyMatches(policy({ notificationType: "promotional" }), target)).toBe(false);
    expect(policyMatches(policy({ channel: "email" }), target)).toBe(false);
    expect(policyMatches(policy({ region: toRegion("US") }), target)).toBe(false);
  });
});

describe("findBlockingPolicy", () => {
  it("returns the first matching policy", () => {
    const nonMatching = policy({ id: "a", region: toRegion("US") });
    const matching = policy({ id: "b", notificationType: "marketing", channel: "sms" });

    expect(findBlockingPolicy([nonMatching, matching], target)).toBe(matching);
  });

  it("returns undefined when nothing matches", () => {
    expect(findBlockingPolicy([policy({ channel: "email" })], target)).toBeUndefined();
  });

  it("returns undefined for an empty policy list", () => {
    expect(findBlockingPolicy([], target)).toBeUndefined();
  });
});
