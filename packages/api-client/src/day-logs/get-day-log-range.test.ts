import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";

import { dayLogRangeQueryKey, getDayLogRange } from "./get-day-log-range.js";
import { dayLogQueryKey } from "./get-day-log.js";

const range = {
  startDate: "2026-08-06",
  endDate: "2026-08-12",
};

const rangeResponse = {
  ...range,
  days: [
    { date: "2026-08-06", dayLog: null },
    { date: "2026-08-07", dayLog: null },
    { date: "2026-08-08", dayLog: null },
    { date: "2026-08-09", dayLog: null },
    { date: "2026-08-10", dayLog: null },
    { date: "2026-08-11", dayLog: null },
    { date: "2026-08-12", dayLog: null },
  ],
};

describe("getDayLogRange", () => {
  it("validates date bounds and requests the exact range endpoint", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => {
      expect(responseBodySchema.safeParse(rangeResponse).success).toBe(true);
      return responseBodySchema.parse(rangeResponse);
    });

    await expect(getDayLogRange({ request } as unknown as ApiTransport, range)).resolves.toEqual(
      rangeResponse,
    );

    expect(request).toHaveBeenCalledWith({
      path: "/daylogs",
      query: range,
      responseBodySchema: expect.any(Object),
    });
  });

  it("rejects an invalid range before calling transport", () => {
    const request = vi.fn();

    expect(() =>
      getDayLogRange({ request } as unknown as ApiTransport, {
        startDate: "2026-08-12",
        endDate: "2026-08-06",
      }),
    ).toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("uses a range-specific key that cannot collide with selected-day queries", () => {
    expect(dayLogRangeQueryKey(range)).toEqual(["dayLogs", "range", "2026-08-06", "2026-08-12"]);
    expect(dayLogRangeQueryKey(range)).not.toEqual(dayLogQueryKey("2026-08-06"));
  });
});
