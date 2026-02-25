import { db } from "./database.js";
import { DayLogRepository } from "../services/ports/day-log-repository.js";
import { DayLog } from "@models/day-log.js";
import { FoodEntry, MealNameEnum } from "@models/food-entry.js";
import { SelectableFoodEntry } from "./databaseSchemas/food-entries-table.js";

export class PostgresDayLogRepository implements DayLogRepository {
  async findLogByDateAndUserId({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | null> {
    const dayLogRow = await db
      .selectFrom("day_logs")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", "=", new Date(date))
      .executeTakeFirst();

    if (!dayLogRow) return null;

    const foodEntries = await db
      .selectFrom("food_entries")
      .selectAll()
      .where("day_log_id", "=", dayLogRow.id)
      .execute();

    const breakfast: FoodEntry[] = [];
    const lunch: FoodEntry[] = [];
    const dinner: FoodEntry[] = [];
    const snacks: FoodEntry[] = [];

    for (const foodEntry of foodEntries) {
      const mappedFoodEntry = this.mapRowToFoodEntry(foodEntry);
      switch (foodEntry.meal) {
        case MealNameEnum.BREAKFAST:
          breakfast.push(mappedFoodEntry);
          break;
        case MealNameEnum.LUNCH:
          lunch.push(mappedFoodEntry);
          break;
        case MealNameEnum.DINNER:
          dinner.push(mappedFoodEntry);
          break;
        case MealNameEnum.SNACKS:
          snacks.push(mappedFoodEntry);
          break;
      }
    }

    return {
      id: dayLogRow.id,
      date: dayLogRow.date,
      weight: dayLogRow.weight ?? 0,
      breakfast,
      lunch,
      dinner,
      snacks,
    };
  }

  private mapRowToFoodEntry(row: SelectableFoodEntry): FoodEntry {
    return {
      id: row.id,
      meal: row.meal,
      name: row.name,
      brand: row.brand,
      iconName: row.icon_name,
      quantity: row.quantity,
      quantityUnit: row.quantity_unit,
      calories: row.calories,
      totalFatGrams: row.total_fat_grams,
      totalCarbohydrateGrams: row.total_carbohydrate_grams,
      proteinGrams: row.protein_grams,
      saturatedFatGrams: row.saturated_fat_grams,
      cholesterolMg: row.cholesterol_mg,
      sodiumMg: row.sodium_mg,
      fiberGrams: row.fiber_grams,
      sugarGrams: row.sugar_grams,
    };
  }
}
