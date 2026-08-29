import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { seedFoundationFoodsCatalog } from "./foundation-foods-catalog-seeder.js";
import { hashFoundationFoodsArchive, type FoundationFoodsSourceManifest } from "./foundation-foods-source.js";

function writeArchive(foods: unknown[]) {
  const directory = path.join(
    os.tmpdir(),
    `foundation-seed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(directory, { recursive: true });
  const archivePath = path.join(directory, "archive.json");
  const bytes = Buffer.from(JSON.stringify({ FoundationFoods: foods }), "utf8");
  writeFileSync(archivePath, bytes);
  return { archivePath, bytes, reportPath: path.join(directory, "catalog-seed-report.json") };
}

function manifestFor(
  bytes: Buffer,
  overrides: Partial<FoundationFoodsSourceManifest> = {},
): FoundationFoodsSourceManifest {
  return {
    releaseId: "FoodData_Central_foundation_food_json_2026-04-30",
    releaseDate: "2026-04-30",
    sourceFile: "archive.json",
    sha256: hashFoundationFoodsArchive(bytes),
    expectedTotalRecordCount: 1,
    expectedImportableRecordCount: 1,
    expectedMappingErrorCount: 0,
    expectedUnreportedNutrientCount: 0,
    ...overrides,
  };
}

describe("seedFoundationFoodsCatalog", () => {
  it("does not open a database transaction when source preflight fails", async () => {
    const { archivePath, bytes, reportPath } = writeArchive([
      {
        fdcId: 321358,
        description: "Hummus, commercial",
        foodNutrients: [],
        foodPortions: [],
      },
    ]);
    const transaction = vi.fn();

    await expect(
      seedFoundationFoodsCatalog({
        databaseClient: { transaction } as never,
        archivePath,
        manifest: manifestFor(bytes, { sha256: "0".repeat(64) }),
        reportPath,
      }),
    ).rejects.toThrow("Foundation Foods archive checksum mismatch");
    expect(transaction).not.toHaveBeenCalled();
  });
});
