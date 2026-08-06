import * as z from "zod";

import { FoodEntryBaseSchema } from "./common/food-entry-base.js";

const FoodSearchResultBaseSchema = FoodEntryBaseSchema.extend({
  sourceLabel: z.string().min(1),
});

export const RecentFoodRecencyMetadataSchema = z.object({
  lastUsedDate: z.iso.date(),
  displayLabel: z.string().min(1).max(12),
});

export const RecentFoodSearchResultSchema = FoodSearchResultBaseSchema.extend({
  source: z.literal("recent"),
  foodEntryId: z.string().min(1),
  recency: RecentFoodRecencyMetadataSchema,
});

export const CatalogFoodSearchResultSchema = FoodSearchResultBaseSchema.extend({
  source: z.literal("catalog"),
  catalogFoodId: z.string().uuid(),
});

export const FoodSearchResultSchema = z.discriminatedUnion("source", [
  RecentFoodSearchResultSchema,
  CatalogFoodSearchResultSchema,
]);

export const FoodSearchResponseSchema = z.object({
  results: z.array(FoodSearchResultSchema),
  nextCursor: z.string().min(1).max(256).nullable(),
});

export const RecentFoodsResponseSchema = z.object({
  results: z.array(RecentFoodSearchResultSchema),
});

export type RecentFoodRecencyMetadata = z.infer<typeof RecentFoodRecencyMetadataSchema>;
export type RecentFoodSearchResult = z.infer<typeof RecentFoodSearchResultSchema>;
export type CatalogFoodSearchResult = z.infer<typeof CatalogFoodSearchResultSchema>;
export type FoodSearchResult = z.infer<typeof FoodSearchResultSchema>;
export type FoodSearchResponse = z.infer<typeof FoodSearchResponseSchema>;
export type RecentFoodsResponse = z.infer<typeof RecentFoodsResponseSchema>;
