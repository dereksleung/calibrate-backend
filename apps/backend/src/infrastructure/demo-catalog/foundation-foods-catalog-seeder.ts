import type { FoodCatalogInput } from "@application/ports/food-catalog-writer.js";

import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { DatabaseClient } from "../persistence/database-client.js";
import type { FoundationFoodsSourceManifest } from "./foundation-foods-source.js";

import { preflightFoundationFoodsSource } from "./foundation-foods-source.js";

export const FOOD_CATALOG_SEED_BATCH_SIZE = 250;

export interface FoundationFoodsSeedReport {
  releaseId: string;
  releaseDate: string;
  sourceFile: string;
  sha256: string;
  totalRecordCount: number;
  importedCount: number;
  mappingErrorCount: number;
  unreportedNutrientCount: number;
  mappingErrors: Array<{ sourceFoodId: string; description: string; error: string }>;
  unreportedNutrients: Array<{ sourceFoodId: string; description: string; nutrient: string }>;
}

function catalogInsertValues(input: FoodCatalogInput, now: Date) {
  return {
    id: randomUUID(),
    name: input.name,
    brand: input.brand,
    quantity_serving: input.quantityServing,
    serving_label: input.servingLabel,
    quantity_mass: input.quantityMass,
    mass_unit: input.massUnit,
    quantity_volume: input.quantityVolume,
    volume_unit: input.volumeUnit,
    calories: input.calories,
    total_fat_grams: input.totalFatGrams,
    saturated_fat_grams: input.saturatedFatGrams,
    cholesterol_mg: input.cholesterolMg,
    sodium_mg: input.sodiumMg,
    total_carbohydrate_grams: input.totalCarbohydrateGrams,
    fiber_grams: input.fiberGrams,
    sugar_grams: input.sugarGrams,
    protein_grams: input.proteinGrams,
    source: input.source,
    source_food_id: input.sourceFoodId,
    normalized_gtin: input.normalizedGtin,
    verification_state: input.verificationState,
    search_text: `${input.name} ${input.brand ?? ""}`.trim().toLowerCase(),
    search_vector: sql`setweight(to_tsvector('simple', ${input.name}), 'A') || setweight(to_tsvector('simple', ${input.brand ?? ""}), 'B')`,
    popularity: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function upsertFoodCatalogBatches(
  databaseClient: DatabaseClient,
  records: FoodCatalogInput[],
  batchSize = FOOD_CATALOG_SEED_BATCH_SIZE,
): Promise<void> {
  const now = new Date();
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize).map((record) => catalogInsertValues(record, now));
    if (batch.length === 0) continue;
    await databaseClient
      .insertInto("food_catalog")
      .values(batch)
      .onConflict((conflict) =>
        conflict.columns(["source", "source_food_id"]).doUpdateSet((eb) => ({
          name: eb.ref("excluded.name"),
          brand: eb.ref("excluded.brand"),
          quantity_serving: eb.ref("excluded.quantity_serving"),
          serving_label: eb.ref("excluded.serving_label"),
          quantity_mass: eb.ref("excluded.quantity_mass"),
          mass_unit: eb.ref("excluded.mass_unit"),
          quantity_volume: eb.ref("excluded.quantity_volume"),
          volume_unit: eb.ref("excluded.volume_unit"),
          calories: eb.ref("excluded.calories"),
          total_fat_grams: eb.ref("excluded.total_fat_grams"),
          saturated_fat_grams: eb.ref("excluded.saturated_fat_grams"),
          cholesterol_mg: eb.ref("excluded.cholesterol_mg"),
          sodium_mg: eb.ref("excluded.sodium_mg"),
          total_carbohydrate_grams: eb.ref("excluded.total_carbohydrate_grams"),
          fiber_grams: eb.ref("excluded.fiber_grams"),
          sugar_grams: eb.ref("excluded.sugar_grams"),
          protein_grams: eb.ref("excluded.protein_grams"),
          normalized_gtin: eb.ref("excluded.normalized_gtin"),
          verification_state: eb.ref("excluded.verification_state"),
          search_text: eb.ref("excluded.search_text"),
          search_vector: eb.ref("excluded.search_vector"),
          updated_at: eb.ref("excluded.updated_at"),
        })),
      )
      .execute();
  }
}

export async function seedFoundationFoodsCatalog(options: {
  databaseClient: DatabaseClient;
  archivePath: string;
  manifest: FoundationFoodsSourceManifest;
  reportPath: string;
  batchSize?: number;
}): Promise<FoundationFoodsSeedReport> {
  const preflight = preflightFoundationFoodsSource({
    archivePath: options.archivePath,
    manifest: options.manifest,
  });

  await options.databaseClient.transaction().execute(async (trx) => {
    await upsertFoodCatalogBatches(trx, preflight.records, options.batchSize ?? FOOD_CATALOG_SEED_BATCH_SIZE);
  });

  const report: FoundationFoodsSeedReport = {
    releaseId: preflight.releaseId,
    releaseDate: preflight.releaseDate,
    sourceFile: preflight.sourceFile,
    sha256: preflight.sha256,
    totalRecordCount: preflight.totalRecordCount,
    importedCount: preflight.importableRecordCount,
    mappingErrorCount: preflight.mappingErrorCount,
    unreportedNutrientCount: preflight.unreportedNutrientCount,
    mappingErrors: preflight.mappingErrors,
    unreportedNutrients: preflight.unreportedNutrients,
  };
  mkdirSync(path.dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function formatFoundationFoodsSeedSummary(
  report: FoundationFoodsSeedReport,
  reportPath: string,
): string {
  return [
    "Demo catalog seed complete",
    `  release: ${report.releaseId}`,
    `  checksum: ${report.sha256}`,
    `  imported: ${report.importedCount}/${report.totalRecordCount}`,
    `  mapping errors: ${report.mappingErrorCount}`,
    `  unreported nutrients: ${report.unreportedNutrientCount}`,
    `  report: ${reportPath}`,
  ].join("\n");
}
