import { apiTransport } from "#/shared/api/api-client.ts";
import { getRollingSevenDayDateRange } from "#/shared/date/local-date-range.ts";
import { useAuthenticatedSession } from "#/verticals/auth/authenticated-session.ts";
import { buildDashboardV2ViewModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import {
  DAY_LOG_VALIDATION_FRESHNESS_MS,
  composeDayLogRangeFromCache,
  dayLogSlotQueryKey,
  dayLogSlotsFromRangeResponse,
  doesDashboardRangeNeedValidation,
  type DayLogSlot,
} from "#/verticals/day-log-cache/day-log-cache.ts";
import { getDayLogRange, getDayLogRangeQueryOptions } from "@calibrate/api-client";
import { skipToken, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { DashboardV2Page } from "./DashboardV2Page.tsx";

export function DashboardV2Container() {
  const session = useAuthenticatedSession();
  const accountId = session!.user.id;
  const queryClient = useQueryClient();
  const dayLogRange = getRollingSevenDayDateRange();
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${dayLogRange.startDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const slotQueries = useQueries({
    queries: dates.map((date) => ({
      queryKey: dayLogSlotQueryKey(accountId, date),
      queryFn: skipToken,
      gcTime: Infinity,
      staleTime: Infinity,
    })),
  });
  const cached = composeDayLogRangeFromCache(queryClient, accountId, dayLogRange);
  const cachedSlots = slotQueries.flatMap(({ data }) => (data ? [data as DayLogSlot] : []));
  const needsValidation = doesDashboardRangeNeedValidation(cachedSlots, Date.now());
  const oldestValidation = cachedSlots.length
    ? Math.min(...cachedSlots.map(({ lastValidatedAt }) => lastValidatedAt))
    : undefined;
  const { queryKey } = getDayLogRangeQueryOptions(apiTransport, accountId, dayLogRange);
  const validation = useQuery({
    queryFn: () => getDayLogRange(apiTransport, dayLogRange),
    queryKey,
    initialData: cached.loadedDateCount > 0 ? cached.response : undefined,
    initialDataUpdatedAt: oldestValidation,
    staleTime: needsValidation ? 0 : DAY_LOG_VALIDATION_FRESHNESS_MS,
  });

  useEffect(() => {
    if (!validation.data || !validation.isFetchedAfterMount) return;
    for (const slot of dayLogSlotsFromRangeResponse(validation.data, validation.dataUpdatedAt)) {
      queryClient.setQueryData(dayLogSlotQueryKey(accountId, slot.date), slot);
    }
  }, [accountId, queryClient, validation.data, validation.dataUpdatedAt, validation.isFetchedAfterMount]);

  const cachedViewModel = cached.loadedDateCount > 0 ? buildDashboardV2ViewModel(cached.response) : undefined;
  const viewModel =
    cachedViewModel ?? (validation.data ? buildDashboardV2ViewModel(validation.data) : undefined);

  return (
    <DashboardV2Page
      error={validation.error}
      isPending={!viewModel && validation.isPending}
      onRetry={() => {
        void validation.refetch();
      }}
      viewModel={viewModel}
    />
  );
}
