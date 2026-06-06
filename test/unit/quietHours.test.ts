import { describe, it, expect } from "vitest";

import {
  isWithinQuietHours,
  minutesToTime,
  parseTimeToMinutes,
  type QuietHours,
} from "../../src/domain/quietHours";

describe("parseTimeToMinutes / minutesToTime", () => {
  it("round-trips a range of valid times", () => {
    for (const time of ["00:00", "08:30", "12:00", "22:00", "23:59"]) {
      expect(minutesToTime(parseTimeToMinutes(time))).toBe(time);
    }
  });

  it("parses minutes since midnight correctly", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("01:30")).toBe(90);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("rejects malformed times", () => {
    expect(() => parseTimeToMinutes("24:00")).toThrow();
    expect(() => parseTimeToMinutes("8:30")).toThrow();
    expect(() => parseTimeToMinutes("noon")).toThrow();
  });
});

describe("isWithinQuietHours", () => {
  it("handles a normal (non-wrapping) window", () => {
    const window: QuietHours = {
      timezone: "Europe/Berlin",
      startMinute: parseTimeToMinutes("09:00"),
      endMinute: parseTimeToMinutes("17:00"),
    };

    // 12:00 UTC is 14:00 Berlin (CEST), inside 09:00 -> 17:00.
    expect(isWithinQuietHours(new Date("2026-05-21T12:00:00Z"), window)).toBe(true);
    // 06:00 UTC is 08:00 Berlin, before the window.
    expect(isWithinQuietHours(new Date("2026-05-21T06:00:00Z"), window)).toBe(false);
  });

  it("handles an overnight-wrapping window (22:00 -> 08:00)", () => {
    const window: QuietHours = {
      timezone: "Europe/Berlin",
      startMinute: parseTimeToMinutes("22:00"),
      endMinute: parseTimeToMinutes("08:00"),
    };

    // 21:30 UTC -> 23:30 Berlin, inside.
    expect(isWithinQuietHours(new Date("2026-05-21T21:30:00Z"), window)).toBe(true);
    // 05:00 UTC -> 07:00 Berlin, still inside (before 08:00).
    expect(isWithinQuietHours(new Date("2026-05-21T05:00:00Z"), window)).toBe(true);
    // 12:00 UTC -> 14:00 Berlin, outside.
    expect(isWithinQuietHours(new Date("2026-05-21T12:00:00Z"), window)).toBe(false);
  });

  it("treats the start boundary as inclusive and the end boundary as exclusive", () => {
    const window: QuietHours = {
      timezone: "UTC",
      startMinute: parseTimeToMinutes("22:00"),
      endMinute: parseTimeToMinutes("08:00"),
    };

    // Exactly 22:00 UTC -> inside.
    expect(isWithinQuietHours(new Date("2026-05-21T22:00:00Z"), window)).toBe(true);
    // Exactly 08:00 UTC -> outside (end is exclusive).
    expect(isWithinQuietHours(new Date("2026-05-21T08:00:00Z"), window)).toBe(false);
  });

  it("returns false for a zero-length window", () => {
    const window: QuietHours = {
      timezone: "UTC",
      startMinute: parseTimeToMinutes("10:00"),
      endMinute: parseTimeToMinutes("10:00"),
    };

    expect(isWithinQuietHours(new Date("2026-05-21T10:00:00Z"), window)).toBe(false);
    expect(isWithinQuietHours(new Date("2026-05-21T03:00:00Z"), window)).toBe(false);
  });
});
