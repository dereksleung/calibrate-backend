import { DayLog, FoodEntry, MealNameEnum } from "@domain";
import { SelectableFoodEntry } from "../schemas/food-entries-table.js";
import { db } from "../../persistence/database.js";
import { GetDayLogByDateAndUserDto } from "../../../application/dtos/day-log-dtos.js";
import { DayLogRepository } from "../../../application/ports/day-log-repository.js";

export class PostgresDayLogRepository implements DayLogRepository {
  async findLogByDateAndUserId({
    userId,
    date,
  }: GetDayLogByDateAndUserDto): Promise<DayLog | null> {
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

    const breakfast: SelectableFoodEntry[] = [];
    const lunch: SelectableFoodEntry[] = [];
    const dinner: SelectableFoodEntry[] = [];
    const snacks: SelectableFoodEntry[] = [];

    for (const foodEntry of foodEntries) {
      switch (foodEntry.meal) {
        case MealNameEnum.BREAKFAST:
          breakfast.push(foodEntry);
          break;
        case MealNameEnum.LUNCH:
          lunch.push(foodEntry);
          break;
        case MealNameEnum.DINNER:
          dinner.push(foodEntry);
          break;
        case MealNameEnum.SNACKS:
          snacks.push(foodEntry);
          break;
      }
    }

    return DayLog.reconstitute({
      id: dayLogRow.id,
      date: dayLogRow.date,
      weight: dayLogRow.weight ?? null,
      breakfast: breakfast.map(this.mapRowToFoodEntry),
      lunch: lunch.map(this.mapRowToFoodEntry),
      dinner: dinner.map(this.mapRowToFoodEntry),
      snacks: snacks.map(this.mapRowToFoodEntry),
    });
  }

  private mapRowToFoodEntry(row: SelectableFoodEntry): FoodEntry {
    return FoodEntry.reconstitute({
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
    });
  }
}
