import { describe, expect, it, vi } from "vitest";

import { FoodSearchController } from "./food-search-controller.js";

describe("FoodSearchController", () => {
  it("validates the query and scopes the staged search to the authenticated user", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [
        {
          kind: "catalog",
          food: {
            id: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
            source: "fdc",
            name: "Greek yogurt",
            brand: "Calibrate Kitchen",
            quantityServing: 1,
            servingLabel: "cup",
            quantityMass: null,
            massUnit: null,
            quantityVolume: null,
            volumeUnit: null,
            calories: 150,
            totalFatGrams: 4,
            saturatedFatGrams: 2,
            cholesterolMg: 10,
            sodiumMg: 65,
            totalCarbohydrateGrams: 8,
            fiberGrams: 0,
            sugarGrams: 6,
            proteinGrams: 18,
            sourceFoodId: "123",
            normalizedGtin: null,
            verificationState: "verified",
            popularity: 0,
          },
        },
      ],
      nextCursor: null,
    });
    const controller = new FoodSearchController({ search });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await controller.search(
      { auth: { userId: "user-1" }, query: { query: " greek yogurt ", limit: "10" } } as never,
      { status, json } as never,
    );

    expect(search).toHaveBeenCalledWith({ userId: "user-1", query: "greek yogurt", limit: 10 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      results: [
        {
          source: "catalog",
          catalogFoodId: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
          sourceLabel: "USDA FoodData Central",
          name: "Greek yogurt",
          brand: "Calibrate Kitchen",
          quantityServing: 1,
          servingLabel: "cup",
          quantityMass: null,
          massUnit: null,
          quantityVolume: null,
          volumeUnit: null,
          calories: 150,
          totalFatGrams: 4,
          saturatedFatGrams: 2,
          cholesterolMg: 10,
          sodiumMg: 65,
          totalCarbohydrateGrams: 8,
          fiberGrams: 0,
          sugarGrams: 6,
          proteinGrams: 18,
        },
      ],
      nextCursor: null,
    });
  });

  it("rejects an unvalidated query before calling the service", async () => {
    const search = vi.fn();
    const controller = new FoodSearchController({ search });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await controller.search(
      { auth: { userId: "user-1" }, query: { query: "yo" } } as never,
      { status, json } as never,
    );

    expect(search).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});
