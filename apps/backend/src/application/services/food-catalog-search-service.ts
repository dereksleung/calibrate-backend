import type { FoodSearchResponse } from "@calibrate/api-contracts";

import type { IFoodCatalogImporter } from "../ports/food-catalog-importer.js";
import type { IFoodCatalogSearchQuery } from "../ports/food-catalog-search-query.js";
import type { FoodCatalogRecord } from "../ports/food-catalog-writer.js";
import type { IRecentFoodQuery, RecentFoodRecord } from "../ports/recent-food-query.js";

export interface FoodCatalogSearchInput {
  userId: string;
  query: string;
  limit: number;
}

function toCatalogResult(food: FoodCatalogRecord): FoodSearchResponse["results"][number] {
  return {
    source: "catalog",
    catalogFoodId: food.id,
    sourceLabel: food.source === "fdc" ? "USDA FoodData Central" : food.source,
    name: food.name,
    brand: food.brand,
    quantityServing: food.quantityServing,
    servingLabel: food.servingLabel,
    quantityMass: food.quantityMass,
    massUnit: food.massUnit,
    quantityVolume: food.quantityVolume,
    volumeUnit: food.volumeUnit,
    calories: food.calories,
    totalFatGrams: food.totalFatGrams,
    saturatedFatGrams: food.saturatedFatGrams,
    cholesterolMg: food.cholesterolMg,
    sodiumMg: food.sodiumMg,
    totalCarbohydrateGrams: food.totalCarbohydrateGrams,
    fiberGrams: food.fiberGrams,
    sugarGrams: food.sugarGrams,
    proteinGrams: food.proteinGrams,
  };
}

function toRecentResult(food: RecentFoodRecord): FoodSearchResponse["results"][number] {
  return {
    source: "recent",
    foodEntryId: food.foodEntryId,
    sourceLabel: "Recent",
    recency: { lastUsedDate: food.lastUsedDate, displayLabel: "Recent" },
    name: food.name,
    brand: food.brand,
    quantityServing: food.quantityServing,
    servingLabel: food.servingLabel,
    quantityMass: food.quantityMass,
    massUnit: food.massUnit,
    quantityVolume: food.quantityVolume,
    volumeUnit: food.volumeUnit,
    calories: food.calories,
    totalFatGrams: food.totalFatGrams,
    saturatedFatGrams: food.saturatedFatGrams,
    cholesterolMg: food.cholesterolMg,
    sodiumMg: food.sodiumMg,
    totalCarbohydrateGrams: food.totalCarbohydrateGrams,
    fiberGrams: food.fiberGrams,
    sugarGrams: food.sugarGrams,
    proteinGrams: food.proteinGrams,
  };
}

/** Coordinates local private/catalog reads; the external importer is zero-local-hit only. */
export class FoodCatalogSearchService {
  constructor(
    private readonly catalogSearchQuery: IFoodCatalogSearchQuery,
    private readonly recentFoodQuery: IRecentFoodQuery,
    private readonly catalogImporter: IFoodCatalogImporter,
  ) {}

  async search(input: FoodCatalogSearchInput): Promise<FoodSearchResponse> {
    const [catalogFoods, recentFoods] = await Promise.all([
      this.catalogSearchQuery.search({ query: input.query, limit: input.limit }),
      this.recentFoodQuery.search({ userId: input.userId, query: input.query, limit: input.limit }),
    ]);

    if (catalogFoods.length === 0 && recentFoods.length === 0) {
      const importedFoods = await this.catalogImporter.searchAndImport(input.query, input.limit);
      return { results: importedFoods.map(toCatalogResult).slice(0, input.limit), nextCursor: null };
    }

    const catalogIdsAlreadyRepresented = new Set(
      recentFoods.flatMap((food) => (food.catalogFoodId ? [food.catalogFoodId] : [])),
    );
    const results = [
      ...recentFoods.map(toRecentResult),
      ...catalogFoods.filter((food) => !catalogIdsAlreadyRepresented.has(food.id)).map(toCatalogResult),
    ].slice(0, input.limit);

    return { results, nextCursor: null };
  }
}
