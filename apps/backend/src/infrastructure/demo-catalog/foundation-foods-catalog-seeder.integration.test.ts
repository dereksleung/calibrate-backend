import type { FoodCatalogInput } from "@application/ports/food-catalog-writer.js";

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../test/integration/database.js";
import { seedFoundationFoodsCatalog, upsertFoodCatalogBatches } from "./foundation-foods-catalog-seeder.js";
import {
  FOUNDATION_FOODS_SOURCE_FILE_NAME,
  hashFoundationFoodsArchive,
  type FoundationFoodsSourceManifest,
} from "./foundation-foods-source.js";

function nutrient(id: number, amount: number) {
  return { nutrient: { id }, amount };
}

function sourceFood(fdcId: number, description: string) {
  return {
    fdcId,
    description,
    foodNutrients: [
      nutrient(1008, 100),
      nutrient(1003, 8),
      nutrient(1004, 4),
      nutrient(1005, 12),
      nutrient(1258, 1),
      nutrient(1253, 0),
      nutrient(1093, 50),
      nutrient(1079, 2),
      nutrient(2000, 1),
    ],
    foodPortions: [],
  };
}

function catalogRecord(overrides: Partial<FoodCatalogInput> = {}): FoodCatalogInput {
  return {
    name: "Hummus, commercial",
    brand: null,
    quantityServing: 100,
    servingLabel: "g",
    quantityMass: 100,
    massUnit: "g",
    quantityVolume: null,
    volumeUnit: null,
    calories: 100,
    totalFatGrams: 4,
    saturatedFatGrams: 1,
    cholesterolMg: 0,
    sodiumMg: 50,
    totalCarbohydrateGrams: 12,
    fiberGrams: 2,
    sugarGrams: 1,
    proteinGrams: 8,
    source: "fdc",
    sourceFoodId: "321358",
    normalizedGtin: null,
    verificationState: "verified",
    ...overrides,
  };
}

function writeArchive(foods: unknown[]) {
  const directory = path.join(
    os.tmpdir(),
    `foundation-seed-it-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(directory, { recursive: true });
  const archivePath = path.join(directory, FOUNDATION_FOODS_SOURCE_FILE_NAME);
  const bytes = Buffer.from(JSON.stringify({ FoundationFoods: foods }), "utf8");
  writeFileSync(archivePath, bytes);
  return { archivePath, bytes, reportPath: path.join(directory, "catalog-seed-report.json") };
}

function manifestFor(bytes: Buffer, foods: unknown[]): FoundationFoodsSourceManifest {
  return {
    releaseId: "FoodData_Central_foundation_food_json_2026-04-30",
    releaseDate: "2026-04-30",
    sourceFile: FOUNDATION_FOODS_SOURCE_FILE_NAME,
    sha256: hashFoundationFoodsArchive(bytes),
    expectedTotalRecordCount: foods.length,
    expectedImportableRecordCount: foods.filter((food) => food !== null).length,
    expectedMappingErrorCount: foods.filter((food) => food === null).length,
    expectedUnreportedNutrientCount: 0,
  };
}

describe("seedFoundationFoodsCatalog", () => {
  const databaseClient = createIntegrationDatabaseClient();

  beforeEach(async () => {
    await clearIntegrationDatabase(databaseClient);
  });

  afterAll(async () => {
    await databaseClient.destroy();
  });

  it("upserts mapped foods idempotently without duplicating catalog rows", async () => {
    const foods = [
      sourceFood(321358, "Hummus, commercial"),
      sourceFood(323121, "Frankfurter, beef, unheated"),
    ];
    const { archivePath, bytes, reportPath } = writeArchive(foods);
    const options = {
      databaseClient,
      archivePath,
      manifest: manifestFor(bytes, foods),
      reportPath,
      batchSize: 1,
    };

    await seedFoundationFoodsCatalog(options);
    await seedFoundationFoodsCatalog({
      ...options,
      archivePath,
      manifest: manifestFor(bytes, foods),
    });

    const rows = await databaseClient
      .selectFrom("food_catalog")
      .select(["source_food_id", "name", "calories"])
      .orderBy("source_food_id")
      .execute();

    expect(rows).toEqual([
      { source_food_id: "321358", name: "Hummus, commercial", calories: 100 },
      { source_food_id: "323121", name: "Frankfurter, beef, unheated", calories: 100 },
    ]);
  });

  it("rolls back every catalog write when a later bulk batch fails", async () => {
    await expect(
      databaseClient.transaction().execute(async (trx: typeof databaseClient) => {
        await upsertFoodCatalogBatches(
          trx,
          [
            catalogRecord({ sourceFoodId: "1", name: "Kept only if the transaction commits" }),
            catalogRecord({
              sourceFoodId: "2",
              name: "x".repeat(200),
            }),
          ],
          1,
        );
      }),
    ).rejects.toThrow();

    const remaining = await databaseClient.selectFrom("food_catalog").selectAll().execute();
    expect(remaining).toEqual([]);
  });
});
