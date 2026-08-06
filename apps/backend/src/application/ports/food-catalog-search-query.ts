import type { FoodCatalogRecord } from "./food-catalog-writer.js";

export interface FoodCatalogSearchInput {
  query: string;
  limit: number;
}

export interface IFoodCatalogSearchQuery {
  search(input: FoodCatalogSearchInput): Promise<FoodCatalogRecord[]>;
}
