import { BusinessLogicError } from "@domain/errors/business-logic-error.js";
import { describe, expect, it } from "vitest";

import { DayLogVersionNumber, MAX_DAY_LOG_VERSION_NUMBER } from "../day-log-version-number.js";

describe("DayLogVersionNumber", () => {
  it("accepts the initial positive int32 value", () => {
    expect(DayLogVersionNumber.from(1).value).toBe(1);
  });

  it("accepts the maximum int32 value", () => {
    expect(DayLogVersionNumber.from(MAX_DAY_LOG_VERSION_NUMBER).value).toBe(MAX_DAY_LOG_VERSION_NUMBER);
  });

  it("rejects zero, negatives, non-integers, and values above int32", () => {
    expect(() => DayLogVersionNumber.from(0)).toThrow(BusinessLogicError);
    expect(() => DayLogVersionNumber.from(-1)).toThrow(BusinessLogicError);
    expect(() => DayLogVersionNumber.from(1.5)).toThrow(BusinessLogicError);
    expect(() => DayLogVersionNumber.from(MAX_DAY_LOG_VERSION_NUMBER + 1)).toThrow(BusinessLogicError);
  });
});
