import { FoodSearchRequestQuerySchema, FoodSearchResponseSchema, type FoodSearchResponse } from "@calibrate/api-contracts";
import { queryOptions, useQuery } from "@tanstack/react-query";

import type { ApiTransport } from "../transport.js";

export interface SearchFoodsInput { query: string; cursor?: string; limit?: number; }

export const foodSearchQueryKey = (input: SearchFoodsInput) => ["foods", "search", input] as const;

export function searchFoods(transport: ApiTransport, input: SearchFoodsInput, signal?: AbortSignal): Promise<FoodSearchResponse> {
  const validatedInput = FoodSearchRequestQuerySchema.parse(input);
  return transport.request({ path: "/foods/search", query: validatedInput, signal, responseBodySchema: FoodSearchResponseSchema });
}

export function searchFoodsQueryOptions(transport: ApiTransport, input: SearchFoodsInput) {
  const validatedInput = FoodSearchRequestQuerySchema.parse(input);
  return queryOptions({
    queryKey: foodSearchQueryKey(validatedInput),
    queryFn: ({ signal }) => searchFoods(transport, validatedInput, signal),
  });
}

/** Portable staged-search hook. React Query aborts superseded queries through the request signal. */
export function useFoodSearch(transport: ApiTransport, input: SearchFoodsInput, enabled = true) {
  return useQuery({ ...searchFoodsQueryOptions(transport, input), enabled });
}
