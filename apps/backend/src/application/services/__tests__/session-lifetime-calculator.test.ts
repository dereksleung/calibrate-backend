import { describe, expect, it } from "vitest";

import { calculateSessionLifetimes } from "../session-lifetime-calculator.js";

describe("calculateSessionLifetimes", () => {
  it("uses the ADR inactivity and absolute lifetimes", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");

    expect(calculateSessionLifetimes(now)).toEqual({
      accessInactivityExpiresAt: new Date("2026-08-01T12:30:00.000Z"),
      accessAbsoluteExpiresAt: new Date("2026-08-01T20:00:00.000Z"),
      familyInactivityExpiresAt: new Date("2026-08-08T12:00:00.000Z"),
      familyAbsoluteExpiresAt: new Date("2026-08-31T12:00:00.000Z"),
    });
  });
});
