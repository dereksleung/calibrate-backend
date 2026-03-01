import { db } from "./database.js";
import { DayLogRepository } from "../services/ports/day-log-repository.js";
import {
  MealNameEnum,
  GetDayLogByDateAndUserDto,
  DayLogPersistenceDto,
} from "@models";
import { SelectableFoodEntry } from "./databaseSchemas/food-entries-table.js";
import { FoodEntryPersistenceDto } from "src/services/dtos/food-entry-dtos.js";

export class PostgresDayLogRepository implements DayLogRepository {
  async findLogByDateAndUserId({
    userId,
    date,
  }: GetDayLogByDateAndUserDto): Promise<DayLogPersistenceDto | null> {
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

    const breakfast: FoodEntryPersistenceDto[] = [];
    const lunch: FoodEntryPersistenceDto[] = [];
    const dinner: FoodEntryPersistenceDto[] = [];
    const snacks: FoodEntryPersistenceDto[] = [];

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
      weight: dayLogRow.weight ?? null,
      breakfast,
      lunch,
      dinner,
      snacks,
    };
  }

  private mapRowToFoodEntry(row: SelectableFoodEntry): FoodEntryPersistenceDto {
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
