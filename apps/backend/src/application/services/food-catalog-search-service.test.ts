import { describe, expect, it, vi } from "vitest";

import { FoodCatalogSearchService } from "./food-catalog-search-service.js";

const catalogResult = {
  id: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
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
  source: "fdc",
  sourceFoodId: "123",
  normalizedGtin: null,
  verificationState: "verified" as const,
  popularity: 0,
};

describe("FoodCatalogSearchService", () => {
  it("returns local catalog and private recents in their combined backend order without using the provider", async () => {
    const catalogSearch = { search: vi.fn().mockResolvedValue([catalogResult]) };
    const recentSearch = {
      search: vi.fn().mockResolvedValue([
        { ...catalogResult, foodEntryId: "entry-1", catalogFoodId: null, lastUsedDate: "2026-08-04" },
      ]),
    };
    const importer = { searchAndImport: vi.fn() };
    const service = new FoodCatalogSearchService(catalogSearch, recentSearch, importer);

    const response = await service.search({ userId: "user-1", query: "greek yogurt", limit: 20 });

    expect(response.results.map((result) => result.source)).toEqual(["recent", "catalog"]);
    expect(importer.searchAndImport).not.toHaveBeenCalled();
    expect(response.nextCursor).toBeNull();
  });

  it("imports provider results only after both local sources miss", async () => {
    const catalogSearch = { search: vi.fn().mockResolvedValue([]) };
    const recentSearch = { search: vi.fn().mockResolvedValue([]) };
    const importer = { searchAndImport: vi.fn().mockResolvedValue([catalogResult]) };
    const service = new FoodCatalogSearchService(catalogSearch, recentSearch, importer);

    const response = await service.search({ userId: "user-1", query: "greek yogurt", limit: 20 });

    expect(importer.searchAndImport).toHaveBeenCalledWith("greek yogurt", 20);
    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({ source: "catalog", catalogFoodId: catalogResult.id });
  });

  it("uses an opaque cursor to return a stable next page from the backend-ordered local results", async () => {
    const catalogSearch = { search: vi.fn().mockResolvedValue([catalogResult, { ...catalogResult, id: "54ad5c41-c838-494c-9781-1f317ddb0c5e", name: "Skyr" }]) };
    const recentSearch = { search: vi.fn().mockResolvedValue([]) };
    const service = new FoodCatalogSearchService(catalogSearch, recentSearch, { searchAndImport: vi.fn() });

    const first = await service.search({ userId: "user-1", query: "yogurt", limit: 1 });
    const second = await service.search({ userId: "user-1", query: "yogurt", limit: 1, cursor: first.nextCursor! });

    expect(first.results[0]).toMatchObject({ name: "Greek yogurt" });
    expect(first.nextCursor).toBeTruthy();
    expect(second.results[0]).toMatchObject({ name: "Skyr" });
    expect(second.nextCursor).toBeNull();
  });
});
