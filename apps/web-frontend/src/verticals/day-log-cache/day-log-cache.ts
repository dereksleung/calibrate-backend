import type { DehydratedState, QueryClient } from "@tanstack/react-query";

import { DayLogResponseSchema, type DayLogRangeResponse } from "@calibrate/api-contracts";

export const DAY_LOG_VALIDATION_FRESHNESS_MS = 60 * 60 * 1_000;
export const DAY_LOG_CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const DAY_LOG_CACHE_BUSTER = "day-log-cache-v1";

export type DayLogSlot =
  | {
      status: "known-empty";
      date: string;
      lastValidatedAt: number;
      unverified: boolean;
    }
  | {
      status: "present";
      date: string;
      dayLog: NonNullable<DayLogRangeResponse["days"][number]["dayLog"]>;
      lastValidatedAt: number;
      unverified: boolean;
      /** Populated by the bounded-sync protocol in issue 02. */
      versionNumber: number | null;
    };

export type PersistedDayLogClient = {
  buster: string;
  timestamp: number;
  clientState: DehydratedState;
};

export const dayLogSlotQueryKeyPrefix = (accountId: string) => ["dayLogs", accountId, "slot"] as const;

export const dayLogSlotQueryKey = (accountId: string, date: string) =>
  [...dayLogSlotQueryKeyPrefix(accountId), date] as const;

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);

  while (cursor.toISOString().slice(0, 10) <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function dayLogSlotsFromRangeResponse(
  response: DayLogRangeResponse,
  lastValidatedAt: number,
): DayLogSlot[] {
  return response.days.map(({ date, dayLog }) =>
    dayLog === null
      ? { status: "known-empty", date, lastValidatedAt, unverified: false }
      : {
          status: "present",
          date,
          dayLog,
          lastValidatedAt,
          unverified: false,
          versionNumber: null,
        },
  );
}

export function composeDayLogRangeFromCache(
  queryClient: Pick<QueryClient, "getQueryData">,
  accountId: string,
  range: { startDate: string; endDate: string },
) {
  const slots = dateRange(range.startDate, range.endDate)
    .map((date) => queryClient.getQueryData<DayLogSlot>(dayLogSlotQueryKey(accountId, date)))
    .filter((slot): slot is DayLogSlot => slot !== undefined);

  return {
    isComplete: slots.length === dateRange(range.startDate, range.endDate).length,
    loadedDateCount: slots.length,
    response: {
      ...range,
      days: slots.map((slot) => ({
        date: slot.date,
        dayLog: slot.status === "present" ? slot.dayLog : null,
      })),
    } satisfies DayLogRangeResponse,
    slots,
  };
}

export function doesDashboardRangeNeedValidation(slots: readonly DayLogSlot[], now: number): boolean {
  return (
    slots.length !== 7 ||
    slots.some(
      ({ lastValidatedAt, unverified }) =>
        unverified || now - lastValidatedAt >= DAY_LOG_VALIDATION_FRESHNESS_MS,
    )
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDayLogSlot(value: unknown): value is DayLogSlot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DayLogSlot>;
  if (
    !isIsoDate(candidate.date) ||
    typeof candidate.lastValidatedAt !== "number" ||
    !Number.isFinite(candidate.lastValidatedAt) ||
    typeof candidate.unverified !== "boolean"
  ) {
    return false;
  }

  if (candidate.status === "known-empty") return true;
  if (candidate.status !== "present") return false;

  const versionNumber = candidate.versionNumber;
  return (
    DayLogResponseSchema.safeParse(candidate.dayLog).success &&
    candidate.dayLog !== null &&
    candidate.dayLog !== undefined &&
    candidate.dayLog.date === candidate.date &&
    (versionNumber === null ||
      (typeof versionNumber === "number" && Number.isInteger(versionNumber) && versionNumber > 0))
  );
}

export function isPersistableDayLogQueryData(
  queryKey: readonly unknown[],
  data: unknown,
  accountId: string,
  now = Date.now(),
): boolean {
  if (
    queryKey.length !== 4 ||
    queryKey[0] !== "dayLogs" ||
    queryKey[1] !== accountId ||
    queryKey[2] !== "slot" ||
    !isIsoDate(queryKey[3])
  ) {
    return false;
  }

  return (
    isDayLogSlot(data) &&
    data.date === queryKey[3] &&
    data.lastValidatedAt <= now &&
    now - data.lastValidatedAt < DAY_LOG_CACHE_RETENTION_MS
  );
}

export function isPersistableDayLogQuery(
  query: DehydratedState["queries"][number],
  accountId: string,
  now = Date.now(),
): boolean {
  return isPersistableDayLogQueryData(query.queryKey, query.state.data, accountId, now);
}

export function prunePersistedDayLogClient(
  persistedClient: PersistedDayLogClient,
  accountId: string,
  now = Date.now(),
): PersistedDayLogClient | undefined {
  if (
    !persistedClient ||
    typeof persistedClient.timestamp !== "number" ||
    typeof persistedClient.buster !== "string" ||
    !persistedClient.clientState ||
    !Array.isArray(persistedClient.clientState.queries)
  ) {
    return undefined;
  }

  return {
    ...persistedClient,
    clientState: {
      mutations: [],
      queries: persistedClient.clientState.queries.filter((query) =>
        isPersistableDayLogQuery(query, accountId, now),
      ),
    },
  };
}
