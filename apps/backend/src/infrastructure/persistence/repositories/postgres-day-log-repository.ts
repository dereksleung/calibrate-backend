import { datesNeedingSyncPayload, listInclusiveDates } from "@application/day-log-sync.js";
import { DayLog } from "@domain/entities/day-log.js";
import { FoodEntry, MealNameEnum } from "@domain/entities/food-entry.js";
import { sql, type Transaction } from "kysely";
import { randomUUID } from "node:crypto";

import type {
  AddFoodEntryResult,
  FindDayLogByDateAndUserInput,
  FindDayLogsByDateRangeAndUserInput,
  FindOrCreateDayLogByDateAndUserInput,
  IDayLogRepository,
} from "../../../application/ports/day-log-repository.js";
import type {
  DayLogSyncQueryInput,
  DayLogSyncQueryResult,
  IDayLogSyncQuery,
} from "../../../application/ports/day-log-sync-query.js";
import type { DatabaseClient, DatabaseSchema } from "../../persistence/database-client.js";

import { SelectableDayLog } from "../schemas/day-logs-table.js";
import { InsertableFoodEntry, SelectableFoodEntry } from "../schemas/food-entries-table.js";

interface FoodEntriesByMeal {
  breakfast: FoodEntry[];
  lunch: FoodEntry[];
  dinner: FoodEntry[];
  snacks: FoodEntry[];
}

type DayLogQueryExecutor = DatabaseClient | Transaction<DatabaseSchema>;

export class PostgresDayLogRepository implements IDayLogRepository, IDayLogSyncQuery {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findOrCreateByDateAndUserId({ date, userId }: FindOrCreateDayLogByDateAndUserInput): Promise<DayLog> {
    if (!date) throw new Error("Date is required");
    const persistenceDate = Temporal.PlainDate.from(date).toString();
    let dayLogRow: SelectableDayLog;

    const foundRow = await this.databaseClient
      .selectFrom("day_logs")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", "=", persistenceDate)
      .executeTakeFirst();

    if (foundRow) {
      dayLogRow = foundRow;
    } else {
      const newRow = await this.databaseClient
        .insertInto("day_logs")
        .values({
          id: randomUUID(),
          date: persistenceDate,
          user_id: userId,
          weight: null,
          version_number: 1,
        })
        .returningAll()
        .executeTakeFirst();

      if (!newRow) throw new Error("Failed to create day log");

      dayLogRow = newRow;
    }

    const meals = await this.getFoodEntriesByDayLogId(dayLogRow.id);
    return this.toDayLog(dayLogRow, meals);
  }

  async countDayLogsByUserId(userId: string): Promise<number> {
    const count = await this.databaseClient
      .selectFrom("day_logs")
      .select((eb) => eb.fn.countAll().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return Number(count?.count ?? 0);
  }

  async addFoodEntry(dayLogId: string, foodEntry: FoodEntry): Promise<AddFoodEntryResult> {
    return this.databaseClient.transaction().execute(async (trx) => {
      const foodEntryRow = await trx
        .insertInto("food_entries")
        .values({
          ...this.mapFoodEntryToRow(foodEntry),
          day_log_id: dayLogId,
        })
        .returningAll()
        .executeTakeFirst();
      if (!foodEntryRow) throw new Error("Failed to add food entry");

      const updated = await trx
        .updateTable("day_logs")
        .set({
          version_number: sql`version_number + 1`,
          updated_at: new Date(),
        })
        .where("id", "=", dayLogId)
        .returning("version_number")
        .executeTakeFirst();

      if (!updated) {
        throw new Error("Failed to advance day log version");
      }

      return {
        foodEntry: this.mapRowToFoodEntry(foodEntryRow),
        versionNumber: updated.version_number,
      };
    });
  }

  async findLogByDateAndUserId({ userId, date }: FindDayLogByDateAndUserInput): Promise<DayLog | null> {
    const persistenceDate = Temporal.PlainDate.from(date).toString();
    const dayLogRow = await this.databaseClient
      .selectFrom("day_logs")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", "=", persistenceDate)
      .executeTakeFirst();

    if (!dayLogRow) return null;

    const meals = await this.getFoodEntriesByDayLogId(dayLogRow.id);
    return this.toDayLog(dayLogRow, meals);
  }

  async findLogsByDateRangeAndUserId({
    userId,
    startDate,
    endDate,
  }: FindDayLogsByDateRangeAndUserInput): Promise<DayLog[]> {
    const dayLogRows = await this.databaseClient
      .selectFrom("day_logs")
      .selectAll()
      .where("user_id", "=", userId)
      .where("date", ">=", Temporal.PlainDate.from(startDate).toString())
      .where("date", "<=", Temporal.PlainDate.from(endDate).toString())
      .orderBy("date", "asc")
      .execute();

    if (dayLogRows.length === 0) return [];

    const foodEntriesByDayLogId = await this.getFoodEntriesByDayLogIds(dayLogRows.map((dayLog) => dayLog.id));

    return dayLogRows.map((dayLog) =>
      this.toDayLog(dayLog, foodEntriesByDayLogId.get(dayLog.id) ?? this.emptyMeals()),
    );
  }

  async readCoherentSnapshot(input: DayLogSyncQueryInput): Promise<DayLogSyncQueryResult> {
    return this.databaseClient
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (trx) => {
        const startDate = Temporal.PlainDate.from(input.startDate).toString();
        const endDate = Temporal.PlainDate.from(input.endDate).toString();
        const projectionRows = await trx
          .selectFrom("day_logs")
          .select(["date", "version_number"])
          .where("user_id", "=", input.userId)
          .where("date", ">=", startDate)
          .where("date", "<=", endDate)
          .execute();

        const serverVersionsByDate = new Map(projectionRows.map((row) => [row.date, row.version_number]));
        const datesToLoad = datesNeedingSyncPayload(
          listInclusiveDates(startDate, endDate),
          input.known,
          serverVersionsByDate,
        );

        if (datesToLoad.length === 0) {
          return { status: "unchanged" };
        }

        const dayLogRows = await trx
          .selectFrom("day_logs")
          .selectAll()
          .where("user_id", "=", input.userId)
          .where("date", "in", datesToLoad)
          .execute();

        const foodEntriesByDayLogId = await this.getFoodEntriesByDayLogIds(
          dayLogRows.map((row) => row.id),
          trx,
        );
        const dayLogsByDate = new Map(
          dayLogRows.map((row) => [
            row.date,
            this.toDayLog(row, foodEntriesByDayLogId.get(row.id) ?? this.emptyMeals()),
          ]),
        );

        return {
          status: "changed",
          slots: datesToLoad.map((date) => {
            const dayLog = dayLogsByDate.get(date) ?? null;
            return {
              date,
              versionNumber: dayLog?.versionNumber ?? null,
              dayLog,
            };
          }),
        };
      });
  }

  private toDayLog(row: SelectableDayLog, meals: FoodEntriesByMeal): DayLog {
    return DayLog.reconstitute({
      id: row.id,
      date: Temporal.PlainDate.from(row.date),
      weight: row.weight ?? null,
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      dinner: meals.dinner,
      snacks: meals.snacks,
      versionNumber: row.version_number,
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
      id: foodEntry.id,
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

  private async getFoodEntriesByDayLogId(dayLogId: string): Promise<FoodEntriesByMeal> {
    const foodEntriesByDayLogId = await this.getFoodEntriesByDayLogIds([dayLogId]);
    return foodEntriesByDayLogId.get(dayLogId) ?? this.emptyMeals();
  }

  private async getFoodEntriesByDayLogIds(
    dayLogIds: string[],
    executor: DayLogQueryExecutor = this.databaseClient,
  ): Promise<Map<string, FoodEntriesByMeal>> {
    const foodEntriesByDayLogId = new Map<string, FoodEntriesByMeal>(
      dayLogIds.map((dayLogId) => [dayLogId, this.emptyMeals()]),
    );
    if (dayLogIds.length === 0) return foodEntriesByDayLogId;

    const foodEntries = await executor
      .selectFrom("food_entries")
      .selectAll()
      .where("day_log_id", "in", dayLogIds)
      .execute();

    for (const foodEntry of foodEntries) {
      const meals = foodEntriesByDayLogId.get(foodEntry.day_log_id);
      if (!meals) continue;

      switch (foodEntry.meal) {
        case MealNameEnum.BREAKFAST:
          meals.breakfast.push(this.mapRowToFoodEntry(foodEntry));
          break;
        case MealNameEnum.LUNCH:
          meals.lunch.push(this.mapRowToFoodEntry(foodEntry));
          break;
        case MealNameEnum.DINNER:
          meals.dinner.push(this.mapRowToFoodEntry(foodEntry));
          break;
        case MealNameEnum.SNACKS:
          meals.snacks.push(this.mapRowToFoodEntry(foodEntry));
          break;
      }
    }

    return foodEntriesByDayLogId;
  }

  private emptyMeals(): FoodEntriesByMeal {
    return {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
  }
}
