import { describe, expect, it } from "vitest";

import { getLocalWeekdayAbbreviation, getRollingSevenDayDateRange } from "./local-date-range.ts";

describe("local seven-day date helpers", () => {
  it("derives an inclusive local range across a month boundary", () => {
    expect(getRollingSevenDayDateRange(new Date(2026, 2, 1, 12))).toEqual({
      startDate: "2026-02-23",
      endDate: "2026-03-01",
    });
  });

  it("derives weekday abbreviations from date-only values", () => {
    expect(["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"].map(getLocalWeekdayAbbreviation)).toEqual(
      ["Th", "F", "Sa", "Sn"],
    );
  });
});
