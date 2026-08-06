import { describe, expect, it, vi } from "vitest";

import { FoodDataCentralCatalogImporter } from "./food-data-central-catalog-importer.js";

describe("FoodDataCentralCatalogImporter", () => {
  it("maps trusted provider foods and coalesces concurrent searches before upserting", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ foods: [{
      fdcId: 123, description: "Greek yogurt", brandOwner: "Acme", gtinUpc: "012345678905",
      foodNutrients: [
        { nutrientId: 1008, value: 150 }, { nutrientId: 1003, value: 18 }, { nutrientId: 1005, value: 8 }, { nutrientId: 1004, value: 4 },
      ],
    }] }), { status: 200, headers: { "content-type": "application/json" } }));
    const writer = { upsert: vi.fn(async (input) => ({ ...input, id: "2d38c136-5633-4b22-9553-b8a587dd6ba6", popularity: 0 })) };
    const importer = new FoodDataCentralCatalogImporter({ apiKey: "test-key", fetch, writer });

    const [first, second] = await Promise.all([
      importer.searchAndImport("greek yogurt", 20), importer.searchAndImport("greek yogurt", 20),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(writer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      source: "fdc", sourceFoodId: "123", name: "Greek yogurt", calories: 150, proteinGrams: 18,
    }));
    expect(first).toEqual(second);
  });

  it("does not call the provider twice for a cached no-result query", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ foods: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const writer = { upsert: vi.fn() };
    const importer = new FoodDataCentralCatalogImporter({ apiKey: "test-key", fetch, writer });

    await importer.searchAndImport("obscure food", 20);
    await importer.searchAndImport(" obscure  food ", 20);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});
