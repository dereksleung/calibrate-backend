import { type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateFoodEntryRequestRouteParamsSchema,
  CreateFoodEntryRequestSchema,
  FoodEntryResponseSchema,
  type CreateFoodEntryRequest,
  type FoodEntryResponse,
} from "@calibrate/api-contracts";

import { dayLogQueryKey } from "./get-day-log.js";
import type { ApiTransport } from "../transport.js";

export function saveFoodEntry(
  transport: ApiTransport,
  date: string,
  input: CreateFoodEntryRequest,
): Promise<FoodEntryResponse> {
  const validDate = CreateFoodEntryRequestRouteParamsSchema.parse({ date }).date;
  const body = CreateFoodEntryRequestSchema.parse(input);

  return transport.request({
    path: `/daylogs/${validDate}/food-entries`,
    method: "POST",
    body,
    responseBodySchema: FoodEntryResponseSchema,
  });
}

export function getSaveFoodEntryMutationOptions(transport: ApiTransport, date: string) {
  return {
    mutationFn: (input: CreateFoodEntryRequest) => saveFoodEntry(transport, date, input),
  };
}

/** Portable save hook. It refreshes only the selected day after a successful entry creation. */
export function useSaveFoodEntry(
  transport: ApiTransport,
  date: string,
  options?: Omit<UseMutationOptions<FoodEntryResponse, Error, CreateFoodEntryRequest>, "mutationFn">,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options ?? {};
  return useMutation({
    ...getSaveFoodEntryMutationOptions(transport, date),
    ...mutationOptions,
    onSuccess: async (entry, variables, context, mutation) => {
      await queryClient.invalidateQueries({ queryKey: dayLogQueryKey(date) });
      await onSuccess?.(entry, variables, context, mutation);
    },
  });
}
