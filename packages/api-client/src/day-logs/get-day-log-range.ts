import {
  DayLogRangeResponseSchema,
  GetDayLogRangeRequestQuerySchema,
  type DayLogRangeResponse,
  type GetDayLogRangeRequestQuery,
} from "@calibrate/api-contracts";
import { queryOptions, useQuery } from "@tanstack/react-query";

import type { ApiTransport } from "../transport.js";

export const dayLogRangeQueryKeyPrefix = (accountId: string) => ["dayLogs", accountId, "range"] as const;

export const dayLogRangeQueryKey = (accountId: string, { startDate, endDate }: GetDayLogRangeRequestQuery) =>
  [...dayLogRangeQueryKeyPrefix(accountId), startDate, endDate] as const;

export function getDayLogRange(
  transport: ApiTransport,
  input: GetDayLogRangeRequestQuery,
): Promise<DayLogRangeResponse> {
  const validInput = GetDayLogRangeRequestQuerySchema.parse(input);

  return transport.request({
    path: "/daylogs",
    query: validInput,
    responseBodySchema: DayLogRangeResponseSchema,
  });
}

export function getDayLogRangeQueryOptions(
  transport: ApiTransport,
  accountId: string,
  input: GetDayLogRangeRequestQuery,
) {
  const validInput = GetDayLogRangeRequestQuerySchema.parse(input);

  return queryOptions({
    queryKey: dayLogRangeQueryKey(accountId, validInput),
    queryFn: () => getDayLogRange(transport, validInput),
  });
}

/** Portable hook for GET `/daylogs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`. */
export function useDayLogRange(
  transport: ApiTransport,
  accountId: string,
  input: GetDayLogRangeRequestQuery,
) {
  return useQuery(getDayLogRangeQueryOptions(transport, accountId, input));
}
