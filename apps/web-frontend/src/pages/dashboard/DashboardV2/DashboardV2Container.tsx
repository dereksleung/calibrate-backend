import { apiTransport } from "#/shared/api/api-client.ts";
import { getRollingSevenDayDateRange } from "#/shared/date/local-date-range.ts";
import { buildDashboardV2ViewModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import { getDayLogRange, getDayLogRangeQueryOptions } from "@calibrate/api-client";
import { useQuery } from "@tanstack/react-query";

import { DashboardV2Page } from "./DashboardV2Page.tsx";

export function DashboardV2Container() {
  const dayLogRange = getRollingSevenDayDateRange();
  const { queryKey } = getDayLogRangeQueryOptions(apiTransport, dayLogRange);
  // TODO(day-log-cache-revalidation): Compose Dashboard V2 history from the user-scoped,
  // date-keyed 30-day IndexedDB Day Log cache and conditionally revalidate visible ranges.
  // Until that work lands, keep this seven-day query. The idea is that we will persist
  // up to 30 days of logs locally, and users generally will not change logs that are > 1 week
  // old as they will not remember what they ate then, so it will be inconvenient, so the
  // information will be available and fresh. A cheap revalidation will also be added.
  // See the PLAN and PRD at docs/tasks/day-log-cache-revalidation/ for details,
  // the 7 day plan there can be adapted to 28 days.
  const { data, error, isPending, refetch } = useQuery({
    queryFn: () => getDayLogRange(apiTransport, dayLogRange),
    queryKey,
    select: buildDashboardV2ViewModel,
  });

  return (
    <DashboardV2Page
      error={error}
      isPending={isPending}
      onRetry={() => {
        void refetch();
      }}
      viewModel={data}
    />
  );
}
