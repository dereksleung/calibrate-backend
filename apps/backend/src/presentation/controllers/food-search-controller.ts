import type {
  FoodCatalogSearchService,
  FoodCatalogSearchResult,
} from "@application/services/food-catalog-search-service.js";
import type { Request, Response } from "express";

import { AuthenticationError } from "@application/errors/authentication-error.js";
import {
  FoodSearchRequestQuerySchema,
  type FoodSearchRequestQuery,
  type FoodSearchResponse,
} from "@calibrate/api-contracts";
import { handleControllerError } from "@common/errors/controller-error-handler.js";
import { validate } from "@validation/validation-helpers.js";

function toCatalogResult(
  food: Extract<FoodCatalogSearchResult, { kind: "catalog" }>["food"],
): FoodSearchResponse["results"][number] {
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

function toRecentResult(
  food: Extract<FoodCatalogSearchResult, { kind: "recent" }>["food"],
): FoodSearchResponse["results"][number] {
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

export class FoodSearchController {
  constructor(private readonly foodCatalogSearchService: Pick<FoodCatalogSearchService, "search">) {}

  async search(
    req: Request<Record<string, never>, unknown, unknown, FoodSearchRequestQuery>,
    res: Response,
  ): Promise<void> {
    try {
      const validatedQuery = validate(FoodSearchRequestQuerySchema, req.query);
      if (!validatedQuery.isValid) {
        res.status(400).json({ error: "Validation failed", details: validatedQuery.errors });
        return;
      }
      const userId = req.auth?.userId;
      if (!userId) throw new AuthenticationError("Authentication required");
      const searchResult = await this.foodCatalogSearchService.search({ userId, ...validatedQuery.data });
      const response: FoodSearchResponse = {
        results: searchResult.results.map((result) =>
          result.kind === "catalog" ? toCatalogResult(result.food) : toRecentResult(result.food),
        ),
        nextCursor: searchResult.nextCursor,
      };
      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}
