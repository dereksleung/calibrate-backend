import { buildFoodEntry } from "@factories/food-entry.js";
import { types } from "pg";
import { describe, expect, it, vi } from "vitest";

import "../../database-client.js";
import { PostgresDayLogRepository } from "../postgres-day-log-repository.js";

describe("PostgresDayLogRepository", () => {
  it("creates a missing day log for the requested calendar date", async () => {
    let insertedValues: Record<string, unknown> | undefined;
    const queriedDates: unknown[] = [];
    const insertedRow = {
      id: "day-log-1",
      date: "2026-05-18",
      user_id: "user-1",
      weight: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const databaseClient = {
      selectFrom: () => ({
        selectAll: () => ({
          where: () => ({
            where: (_column: string, _operator: string, date: unknown) => {
              queriedDates.push(date);
              return { executeTakeFirst: async () => undefined };
            },
            execute: async () => [],
          }),
        }),
      }),
      insertInto: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values;
          return { returningAll: () => ({ executeTakeFirst: async () => insertedRow }) };
        },
      }),
    };
    const repository = new PostgresDayLogRepository(databaseClient as never);

    const dayLog = await repository.findOrCreateByDateAndUserId({ userId: "user-1", date: "2026-05-18" });

    expect(dayLog.id).toBe("day-log-1");
    expect(dayLog.date.toString()).toBe("2026-05-18");
    expect(insertedValues).toMatchObject({ user_id: "user-1", weight: null });
    expect(insertedValues?.date).toBe("2026-05-18");
    expect(queriedDates).toEqual(["2026-05-18"]);
  });
});

describe("Postgres database date parsing", () => {
  it("keeps SQL date values as calendar-date strings", () => {
    expect(types.getTypeParser(types.builtins.DATE)("2026-05-18")).toBe("2026-05-18");
  });

  it("converts SQL numeric values into JavaScript numbers", () => {
    expect(types.getTypeParser(types.builtins.NUMERIC)("100.25")).toBe(100.25);
  });
});

describe("PostgresDayLogRepository.addFoodEntry", () => {
  it("persists the domain-generated food entry ID", async () => {
    let insertedValues: Record<string, unknown> | undefined;
    const databaseClient = {
      insertInto: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values;
          return { returningAll: () => ({ executeTakeFirst: async () => values }) };
        },
      }),
    };
    const repository = new PostgresDayLogRepository(databaseClient as never);
    const foodEntry = buildFoodEntry({ id: "food-entry-1", dayLogId: "day-log-1" });

    await repository.addFoodEntry("day-log-1", foodEntry);

    expect(insertedValues).toMatchObject({ id: "food-entry-1", day_log_id: "day-log-1" });
  });
});

describe("PostgresDayLogRepository.findLogsByDateRangeAndUserId", () => {
  it("loads the authenticated user's inclusive date range and batches interleaved food entries", async () => {
    const dayLogRows = [
      {
        id: "day-log-1",
        date: "2026-08-06",
        user_id: "user-1",
        weight: 180,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "day-log-2",
        date: "2026-08-12",
        user_id: "user-1",
        weight: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    const foodEntryRows = [
      createFoodEntryRow({ id: "dinner-2", dayLogId: "day-log-2", meal: "DINNER", name: "Dinner two" }),
      createFoodEntryRow({
        id: "breakfast-1",
        dayLogId: "day-log-1",
        meal: "BREAKFAST",
        name: "Breakfast one",
      }),
      createFoodEntryRow({ id: "snacks-1", dayLogId: "day-log-1", meal: "SNACKS", name: "Snack one" }),
      createFoodEntryRow({ id: "lunch-2", dayLogId: "day-log-2", meal: "LUNCH", name: "Lunch two" }),
    ];
    const dayLogWhereCalls: unknown[][] = [];
    const foodEntryWhereCalls: unknown[][] = [];
    const orderBy = vi.fn();
    const dayLogQuery = {
      selectAll: () => dayLogQuery,
      where: (...args: unknown[]) => {
        dayLogWhereCalls.push(args);
        return dayLogQuery;
      },
      orderBy: (...args: unknown[]) => {
        orderBy(...args);
        return dayLogQuery;
      },
      execute: async () => dayLogRows,
    };
    const foodEntryQuery = {
      selectAll: () => foodEntryQuery,
      where: (...args: unknown[]) => {
        foodEntryWhereCalls.push(args);
        return foodEntryQuery;
      },
      execute: async () => foodEntryRows,
    };
    const selectFrom = vi.fn((table: string) => (table === "day_logs" ? dayLogQuery : foodEntryQuery));
    const repository = new PostgresDayLogRepository({ selectFrom } as never);

    const dayLogs = await repository.findLogsByDateRangeAndUserId({
      userId: "user-1",
      startDate: "2026-08-06",
      endDate: "2026-08-12",
    });

    expect(dayLogWhereCalls).toEqual([
      ["user_id", "=", "user-1"],
      ["date", ">=", "2026-08-06"],
      ["date", "<=", "2026-08-12"],
    ]);
    expect(orderBy).toHaveBeenCalledWith("date", "asc");
    expect(foodEntryWhereCalls).toEqual([["day_log_id", "in", ["day-log-1", "day-log-2"]]]);
    expect(dayLogs).toHaveLength(2);
    expect(dayLogs[0]?.date.toString()).toBe("2026-08-06");
    expect(dayLogs[0]?.breakfast?.map((entry) => entry.name)).toEqual(["Breakfast one"]);
    expect(dayLogs[0]?.snacks?.map((entry) => entry.name)).toEqual(["Snack one"]);
    expect(dayLogs[1]?.lunch?.map((entry) => entry.name)).toEqual(["Lunch two"]);
    expect(dayLogs[1]?.dinner?.map((entry) => entry.name)).toEqual(["Dinner two"]);
  });

  it("returns no aggregates without querying food entries when no user-scoped rows match", async () => {
    const dayLogQuery = {
      selectAll: () => dayLogQuery,
      where: () => dayLogQuery,
      orderBy: () => dayLogQuery,
      execute: async () => [],
    };
    const selectFrom = vi.fn(() => dayLogQuery);
    const repository = new PostgresDayLogRepository({ selectFrom } as never);

    await expect(
      repository.findLogsByDateRangeAndUserId({
        userId: "user-1",
        startDate: "2026-08-06",
        endDate: "2026-08-12",
      }),
    ).resolves.toEqual([]);

    expect(selectFrom).toHaveBeenCalledTimes(1);
    expect(selectFrom).toHaveBeenCalledWith("day_logs");
  });
});

function createFoodEntryRow({
  id,
  dayLogId,
  meal,
  name,
}: {
  id: string;
  dayLogId: string;
  meal: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS";
  name: string;
}) {
  return {
    id,
    day_log_id: dayLogId,
    meal,
    name,
    brand: null,
    icon_name: null,
    chosen_quantity: 1,
    chosen_unit: "serving",
    quantity_serving: 1,
    serving_label: "serving",
    quantity_mass: null,
    mass_unit: null,
    quantity_volume: null,
    volume_unit: null,
    calories: 100,
    total_fat_grams: 10,
    saturated_fat_grams: null,
    cholesterol_mg: null,
    sodium_mg: null,
    total_carbohydrate_grams: 10,
    fiber_grams: null,
    sugar_grams: null,
    protein_grams: 10,
    created_at: new Date(),
    updated_at: new Date(),
  };
}
