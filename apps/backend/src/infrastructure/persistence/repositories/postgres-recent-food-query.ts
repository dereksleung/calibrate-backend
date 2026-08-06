import type { IRecentFoodQuery, RecentFoodRecord } from "@application/ports/recent-food-query.js";
import { sql } from "kysely";

import type { DatabaseClient } from "../database-client.js";

export class PostgresRecentFoodQuery implements IRecentFoodQuery {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async search({ userId, query, limit }: { userId: string; query: string; limit: number }): Promise<RecentFoodRecord[]> {
    const since = Temporal.Now.plainDateISO("UTC").subtract({ days: 14 }).toString();
    const rows = await this.databaseClient.selectFrom("food_entries as entry")
      .innerJoin("day_logs as log", "log.id", "entry.day_log_id").selectAll("entry").select(["log.date as last_used_date"])
      .where("log.user_id", "=", userId).where("log.date", ">=", since)
      .where(sql<boolean>`lower(concat_ws(' ', entry.name, entry.brand)) LIKE ${`%${query.toLowerCase()}%`}`)
      .orderBy("log.date", "desc").orderBy("entry.created_at", "desc").limit(limit).execute();
    return rows.map((row) => ({
      foodEntryId: row.id, catalogFoodId: row.food_catalog_id, lastUsedDate: row.last_used_date,
      name: row.name, brand: row.brand, quantityServing: row.quantity_serving, servingLabel: row.serving_label,
      quantityMass: row.quantity_mass, massUnit: row.mass_unit, quantityVolume: row.quantity_volume, volumeUnit: row.volume_unit,
      calories: row.calories, totalFatGrams: row.total_fat_grams, saturatedFatGrams: row.saturated_fat_grams,
      cholesterolMg: row.cholesterol_mg, sodiumMg: row.sodium_mg, totalCarbohydrateGrams: row.total_carbohydrate_grams,
      fiberGrams: row.fiber_grams, sugarGrams: row.sugar_grams, proteinGrams: row.protein_grams,
    }));
  }
}
