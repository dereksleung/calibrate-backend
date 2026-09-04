import { describe, expect, it } from "vitest";

import { datesNeedingSyncPayload, listInclusiveDates } from "../day-log-sync.js";

describe("listInclusiveDates", () => {
  it("includes both endpoints of a contiguous calendar range", () => {
    expect(listInclusiveDates("2026-08-01", "2026-08-03")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
  });
});

describe("datesNeedingSyncPayload", () => {
  const range = listInclusiveDates("2026-08-01", "2026-08-03");

  it("treats omitted dates as Unloaded", () => {
    expect(datesNeedingSyncPayload(range, {}, new Map([["2026-08-01", 1]]))).toEqual(range);
  });

  it("treats null as Known-empty and matches only confirmed absence", () => {
    expect(
      datesNeedingSyncPayload(
        range,
        { "2026-08-01": null, "2026-08-02": null, "2026-08-03": null },
        new Map([["2026-08-02", 1]]),
      ),
    ).toEqual(["2026-08-02"]);
  });

  it("matches a positive version only against the same server revision", () => {
    expect(
      datesNeedingSyncPayload(
        range,
        { "2026-08-01": 2, "2026-08-02": 1, "2026-08-03": 4 },
        new Map([
          ["2026-08-01", 2],
          ["2026-08-02", 3],
        ]),
      ),
    ).toEqual(["2026-08-02", "2026-08-03"]);
  });

  it("returns no dates when every requested slot already matches", () => {
    expect(
      datesNeedingSyncPayload(
        range,
        { "2026-08-01": 1, "2026-08-02": null, "2026-08-03": 4 },
        new Map([
          ["2026-08-01", 1],
          ["2026-08-03", 4],
        ]),
      ),
    ).toEqual([]);
  });
});
