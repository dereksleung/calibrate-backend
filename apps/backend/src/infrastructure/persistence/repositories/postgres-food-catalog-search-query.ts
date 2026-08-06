import type { IFoodCatalogSearchQuery } from "@application/ports/food-catalog-search-query.js";
import type { FoodCatalogRecord } from "@application/ports/food-catalog-writer.js";
import { sql } from "kysely";

import type { DatabaseClient } from "../database-client.js";
import type { SelectableFoodCatalog } from "../schemas/food-catalog-table.js";

function safeTsQuery(query: string): string {
  return query.toLowerCase().split(/\s+/).map((token) => token.replace(/[^a-z0-9]/g, "")).filter(Boolean).map((token) => `${token}:*`).join(" & ");
}

export class PostgresFoodCatalogSearchQuery implements IFoodCatalogSearchQuery {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async search({ query, limit }: { query: string; limit: number }): Promise<FoodCatalogRecord[]> {
    const tsQuery = safeTsQuery(query);
    if (!tsQuery) return [];
    const normalizedQuery = query.toLowerCase();
    const rows = await this.databaseClient.selectFrom("food_catalog").selectAll()
      .where((expression) => expression.or([
        sql<boolean>`search_vector @@ to_tsquery('simple', ${tsQuery})`,
        sql<boolean>`search_text % ${normalizedQuery}`,
      ]))
      .orderBy(sql`CASE WHEN lower(name) = ${normalizedQuery} THEN 0 WHEN lower(name) LIKE ${`${normalizedQuery}%`} THEN 1 ELSE 2 END`)
      .orderBy(sql`ts_rank(search_vector, to_tsquery('simple', ${tsQuery}))`, "desc")
      .orderBy(sql`similarity(search_text, ${normalizedQuery})`, "desc")
      .orderBy("popularity", "desc").orderBy("id", "asc").limit(limit).execute();
    return rows.map((row: SelectableFoodCatalog) => ({
      id: row.id, name: row.name, brand: row.brand, quantityServing: row.quantity_serving, servingLabel: row.serving_label,
      quantityMass: row.quantity_mass, massUnit: row.mass_unit, quantityVolume: row.quantity_volume, volumeUnit: row.volume_unit,
      calories: row.calories, totalFatGrams: row.total_fat_grams, saturatedFatGrams: row.saturated_fat_grams,
      cholesterolMg: row.cholesterol_mg, sodiumMg: row.sodium_mg, totalCarbohydrateGrams: row.total_carbohydrate_grams,
      fiberGrams: row.fiber_grams, sugarGrams: row.sugar_grams, proteinGrams: row.protein_grams, source: row.source,
      sourceFoodId: row.source_food_id, normalizedGtin: row.normalized_gtin, verificationState: "verified", popularity: row.popularity,
    }));
  }
}
