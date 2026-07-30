import type { Kysely } from "kysely";

import { DayLog, FoodEntry, MealNameEnum } from "@domain";

import type { Database } from "../../persistence/database-client.js";

import {
  FindOrCreateDayLogByDateAndUserIdRepositoryDto,
  GetDayLogByDateAndUserDto,
} from "../../../application/dtos/day-log-dtos.js";
import { IDayLogRepository } from "../../../application/ports/day-log-repository.js";
import { SelectableDayLog } from "../schemas/day-logs-table.js";
import { InsertableFoodEntry, SelectableFoodEntry } from "../schemas/food-entries-table.js";

export class PostgresDayLogRepository implements IDayLogRepository {
  constructor(private readonly database: Kysely<Database>) {}

  async findOrCreateByDateAndUserId({
    date,
    userId,
  }: FindOrCreateDayLogByDateAndUserIdRepositoryDto): Promise<DayLog> {
    if (!date) throw new Error("Date is required");
    let dayLogRow: SelectableDayLog;
    if (date) {
      const foundRow = await this.database
        .selectFrom("day_logs")
        .selectAll()
        .where("user_id", "=", userId)
        .where("date", "=", new Date(date))
        .executeTakeFirst();

      if (!foundRow) throw new Error("Day log not found");
      dayLogRow = foundRow;
    } else {
      const newRow = await this.database
        .insertInto("day_logs")
        .values({
          date: new Date().toDateString(),
          user_id: userId,
          weight: null,
        })
        .returningAll()
        .executeTakeFirst();

      if (!newRow) throw new Error("Failed to create day log");

      dayLogRow = newRow;
    }

    const { breakfast, lunch, dinner, snacks } = await this.getFoodEntriesByDayLogId(dayLogRow.id);

    return DayLog.reconstitute({
      id: dayLogRow.id,
      date: dayLogRow.date,
      weight: dayLogRow.weight ?? null,
      breakfast,
      lunch,
      dinner,
      snacks,
    });
  }

  async countDayLogsByUserId(userId: string): Promise<number> {
    const count = await this.database
      .selectFrom("day_logs")
      .select((eb) => eb.fn.countAll().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return Number(count?.count ?? 0);
  }

  /**
   * Considered adding a concurrency check like a WHERE clause checking a version field on the daylog aggregate,
   * but it would be overkill.
   * The DayLog aggregate belongs to one user logging their meals.
   * The realistic concurrency scenario is: the same person, on two devices,
   * adds the 25th breakfast entry at the exact same moment.
   * The probability is vanishingly small.
   */
  async addFoodEntry(dayLogId: string, foodEntry: FoodEntry): Promise<FoodEntry> {
    const foodEntryRow = await this.database
      .insertInto("food_entries")
      .values({
        ...this.mapFoodEntryToRow(foodEntry),
        day_log_id: dayLogId,
      })
      .returningAll()
      .executeTakeFirst();
    if (!foodEntryRow) throw new Error("Failed to add food entry");
    return this.mapRowToFoodEntry(foodEntryRow);
  }

  async findLogByDateAndUserId({ userId, date }: GetDayLogByDateAndUserDto): Promise<DayLog | null> {
    const dayLogRow = await this.database
      .selectFrom("day_logs")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", "=", new Date(date))
      .executeTakeFirst();

    if (!dayLogRow) return null;

    const { breakfast, lunch, dinner, snacks } = await this.getFoodEntriesByDayLogId(dayLogRow.id);

    return DayLog.reconstitute({
      id: dayLogRow.id,
      date: dayLogRow.date,
      weight: dayLogRow.weight ?? null,
      breakfast,
      lunch,
      dinner,
      snacks,
    });
  }

  private mapRowToFoodEntry(row: SelectableFoodEntry): FoodEntry {
    return FoodEntry.reconstitute({
      id: row.id,
      dayLogId: row.day_log_id,
      meal: row.meal,
      name: row.name,
      brand: row.brand,
      iconName: row.icon_name,
      chosenQuantity: row.chosen_quantity,
      chosenUnit: row.chosen_unit,
      quantityServing: row.quantity_serving,
      servingLabel: row.serving_label,
      quantityMass: row.quantity_mass,
      massUnit: row.mass_unit,
      quantityVolume: row.quantity_volume,
      volumeUnit: row.volume_unit,
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

  private mapFoodEntryToRow(foodEntry: FoodEntry): InsertableFoodEntry {
    return {
      day_log_id: foodEntry.dayLogId,
      meal: foodEntry.meal,
      name: foodEntry.name,
      brand: foodEntry.brand,
      icon_name: foodEntry.iconName,
      chosen_quantity: foodEntry.chosenQuantity,
      chosen_unit: foodEntry.chosenUnit,
      quantity_serving: foodEntry.quantityServing,
      serving_label: foodEntry.servingLabel,
      quantity_mass: foodEntry.quantityMass,
      mass_unit: foodEntry.massUnit,
      quantity_volume: foodEntry.quantityVolume,
      volume_unit: foodEntry.volumeUnit,
      calories: foodEntry.calories,
      total_fat_grams: foodEntry.totalFatGrams,
      total_carbohydrate_grams: foodEntry.totalCarbohydrateGrams,
      protein_grams: foodEntry.proteinGrams,
      saturated_fat_grams: foodEntry.saturatedFatGrams,
      cholesterol_mg: foodEntry.cholesterolMg,
      sodium_mg: foodEntry.sodiumMg,
      fiber_grams: foodEntry.fiberGrams,
      sugar_grams: foodEntry.sugarGrams,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async getFoodEntriesByDayLogId(dayLogId: string): Promise<{
    breakfast: FoodEntry[];
    lunch: FoodEntry[];
    dinner: FoodEntry[];
    snacks: FoodEntry[];
  }> {
    const foodEntries = await this.database
      .selectFrom("food_entries")
      .selectAll()
      .where("day_log_id", "=", dayLogId)
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

    return {
      breakfast: breakfast.map(this.mapRowToFoodEntry),
      lunch: lunch.map(this.mapRowToFoodEntry),
      dinner: dinner.map(this.mapRowToFoodEntry),
      snacks: snacks.map(this.mapRowToFoodEntry),
    };
  }
}
