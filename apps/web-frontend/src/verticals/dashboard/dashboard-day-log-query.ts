import type { ApiTransport } from "@calibrate/api-client";
import type {
  DayLogRangeResponse,
  DayLogResponse,
  GetDayLogRangeRequestQuery,
} from "@calibrate/api-contracts";

import { createDayLogCacheWriteGuard } from "#/shared/api/day-log-cache.ts";
import { getAuthenticatedSession } from "#/verticals/auth/authenticated-session.ts";
import {
  dayLogQueryKey,
  dayLogRangeQueryKey,
  getDayLogRange,
} from "@calibrate/api-client";
import {
  CancelledError,
  skipToken,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

export function writeDayLogRangeToCache(
  queryClient: Pick<QueryClient, "setQueryData">,
  response: DayLogRangeResponse,
  canWrite: () => boolean = () => true,
): boolean {
  if (!canWrite()) return false;

  for (const day of response.days) {
    if (!canWrite()) return false;
    queryClient.setQueryData(dayLogQueryKey(day.date), day.dayLog);
  }

  return canWrite();
}

export function composeDayLogRangeFromCache(
  queryClient: Pick<QueryClient, "getQueryData">,
  range: GetDayLogRangeRequestQuery,
): DayLogRangeResponse | undefined {
  const days = getConsecutiveDates(range.startDate, range.endDate).map((date) => ({
    date,
    dayLog: queryClient.getQueryData<DayLogResponse | undefined>(dayLogQueryKey(date)),
  }));

  if (days.some(({ dayLog }) => dayLog === undefined)) return undefined;

  return {
    ...range,
    days: days as DayLogRangeResponse["days"],
  };
}

export function useDashboardDayLogRange(transport: ApiTransport, range: GetDayLogRangeRequestQuery) {
  const queryClient = useQueryClient();
  const dates = getConsecutiveDates(range.startDate, range.endDate);
  const rangeQuery = useQuery({
    queryKey: dayLogRangeQueryKey(range),
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const canWrite = createRangeWriteGuard(queryClient);
      const response = await getDayLogRange(transport, range);
      if (!writeDayLogRangeToCache(queryClient, response, canWrite)) {
        throw new CancelledError({ revert: true, silent: true });
      }
      return response;
    },
  });

  useQueries({
    queries: dates.map((date) => ({
      queryKey: dayLogQueryKey(date),
      queryFn: skipToken,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  });

  const data = composeDayLogRangeFromCache(queryClient, range);
  const refetch = useCallback(() => rangeQuery.refetch(), [rangeQuery.refetch]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void refetch();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [refetch]);

  return {
    data,
    error: rangeQuery.error,
    isPending: data === undefined && rangeQuery.isPending,
    refetch,
  };
}

function createRangeWriteGuard(queryClient: QueryClient): () => boolean {
  const userId = getAuthenticatedSession(queryClient)?.user.id;
  if (!userId) return () => false;

  const cacheGuard = createDayLogCacheWriteGuard(queryClient, userId);
  return () => cacheGuard() && getAuthenticatedSession(queryClient)?.user.id === userId;
}

function getConsecutiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const date = new Date(`${startDate}T00:00:00.000Z`);
  const lastDate = new Date(`${endDate}T00:00:00.000Z`);

  while (date <= lastDate) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return dates;
}
