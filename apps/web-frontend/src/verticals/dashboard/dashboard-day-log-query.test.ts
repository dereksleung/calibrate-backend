import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import { dayLogQueryKey } from "@calibrate/api-client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { composeDayLogRangeFromCache, writeDayLogRangeToCache } from "./dashboard-day-log-query.ts";

const range = {
  startDate: "2026-08-20",
  endDate: "2026-08-22",
};

const emptyDayLog = {
  id: "00000000-0000-0000-0000-000000000001",
  date: "2026-08-21",
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
  weight: 180,
} as const;

function response(): DayLogRangeResponse {
  return {
    ...range,
    days: [
      { date: "2026-08-20", dayLog: null },
      { date: "2026-08-21", dayLog: emptyDayLog },
      { date: "2026-08-22", dayLog: null },
    ],
  } as DayLogRangeResponse;
}

describe("dashboard Day Log query composition", () => {
  it("normalizes a range response into date-keyed entries and composes it back", () => {
    const queryClient = new QueryClient();

    writeDayLogRangeToCache(queryClient, response());

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-20"))).toBeNull();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-21"))).toEqual(emptyDayLog);
    expect(composeDayLogRangeFromCache(queryClient, range)).toEqual(response());
  });

  it("does not treat an unloaded date as a Known-empty day", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(dayLogQueryKey("2026-08-20"), null);
    queryClient.setQueryData(dayLogQueryKey("2026-08-21"), emptyDayLog);

    expect(composeDayLogRangeFromCache(queryClient, range)).toBeUndefined();
  });
});
