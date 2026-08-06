import type { FoodCatalogRecord } from "./food-catalog-writer.js";

export interface IFoodCatalogImporter {
  searchAndImport(query: string, limit: number): Promise<FoodCatalogRecord[]>;
}
