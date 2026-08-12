import type { DayLogRangeResponse, FoodEntryResponse } from "@calibrate/api-contracts";

import { describe, expect, it } from "vitest";

import {
  buildDashboardNutritionModels,
  getDashboardNutritionDateRange,
} from "./dashboard-nutrition-model.ts";

const range = {
  startDate: "2026-08-06",
  endDate: "2026-08-12",
};

function buildFoodEntry(overrides: Partial<FoodEntryResponse> = {}): FoodEntryResponse {
  return {
    id: "food-entry-1",
    meal: "BREAKFAST",
    name: "Breakfast",
    brand: null,
    chosenQuantity: 1,
    chosenUnit: "serving",
    quantityServing: 1,
    servingLabel: "serving",
    quantityMass: null,
    massUnit: null,
    quantityVolume: null,
    volumeUnit: null,
    calories: 100,
    totalFatGrams: 10,
    saturatedFatGrams: null,
    cholesterolMg: null,
    sodiumMg: null,
    totalCarbohydrateGrams: 20,
    fiberGrams: null,
    sugarGrams: null,
    proteinGrams: 30,
    ...overrides,
  };
}

function buildRangeResponse(days: DayLogRangeResponse["days"]): DayLogRangeResponse {
  return { ...range, days };
}

describe("buildDashboardNutritionModels", () => {
  it("totals every meal for all four live nutrition metrics across a full rolling range", () => {
    const response = buildRangeResponse([
      {
        date: "2026-08-06",
        dayLog: {
          id: "00000000-0000-0000-0000-000000000001",
          date: "2026-08-06",
          breakfast: [
            buildFoodEntry({
              calories: 100,
              totalFatGrams: 10,
              proteinGrams: 30,
              totalCarbohydrateGrams: 20,
            }),
          ],
          lunch: [
            buildFoodEntry({
              id: "food-entry-2",
              meal: "LUNCH",
              calories: 200,
              totalFatGrams: 20,
              proteinGrams: 40,
              totalCarbohydrateGrams: 30,
            }),
          ],
          dinner: [
            buildFoodEntry({
              id: "food-entry-3",
              meal: "DINNER",
              calories: 300,
              totalFatGrams: 30,
              proteinGrams: 50,
              totalCarbohydrateGrams: 40,
            }),
          ],
          snacks: [
            buildFoodEntry({
              id: "food-entry-4",
              meal: "SNACKS",
              calories: 400,
              totalFatGrams: 40,
              proteinGrams: 60,
              totalCarbohydrateGrams: 50,
            }),
          ],
          weight: null,
        },
      },
      { date: "2026-08-07", dayLog: null },
      { date: "2026-08-08", dayLog: null },
      { date: "2026-08-09", dayLog: null },
      { date: "2026-08-10", dayLog: null },
      { date: "2026-08-11", dayLog: null },
      {
        date: "2026-08-12",
        dayLog: {
          id: "00000000-0000-0000-0000-000000000002",
          date: "2026-08-12",
          breakfast: [
            buildFoodEntry({
              calories: 500,
              totalFatGrams: 50,
              proteinGrams: 70,
              totalCarbohydrateGrams: 60,
            }),
          ],
          lunch: [
            buildFoodEntry({
              id: "food-entry-6",
              meal: "LUNCH",
              calories: 600,
              totalFatGrams: 60,
              proteinGrams: 80,
              totalCarbohydrateGrams: 70,
            }),
          ],
          dinner: [],
          snacks: [],
          weight: null,
        },
      },
    ]);

    const models = buildDashboardNutritionModels(response);

    expect(models.calories.weeklyData.map((day) => day.eaten)).toEqual([1000, 0, 0, 0, 0, 0, 1100]);
    expect(models.totalFatGrams.weeklyData.map((day) => day.eaten)).toEqual([100, 0, 0, 0, 0, 0, 110]);
    expect(models.proteinGrams.weeklyData.map((day) => day.eaten)).toEqual([180, 0, 0, 0, 0, 0, 150]);
    expect(models.totalCarbohydrateGrams.weeklyData.map((day) => day.eaten)).toEqual([
      140, 0, 0, 0, 0, 0, 130,
    ]);
    expect(models.calories.today).toEqual({ eaten: 1100, limit: 1800 });
    expect(models.totalFatGrams.today).toEqual({ eaten: 110, limit: 60 });
    expect(models.proteinGrams.today).toEqual({ eaten: 150, limit: 120 });
    expect(models.totalCarbohydrateGrams.today).toEqual({ eaten: 130, limit: 220 });
  });

  it("keeps seven oldest-to-newest slots and renders missing days as zero", () => {
    const response = buildRangeResponse([
      { date: "2026-08-06", dayLog: null },
      { date: "2026-08-07", dayLog: null },
      { date: "2026-08-08", dayLog: null },
      { date: "2026-08-09", dayLog: null },
      { date: "2026-08-10", dayLog: null },
      { date: "2026-08-11", dayLog: null },
      { date: "2026-08-12", dayLog: null },
    ]);

    const model = buildDashboardNutritionModels(response).calories;

    expect(model.weeklyData).toHaveLength(7);
    expect(model.weeklyData.map((day) => day.eaten)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(model.today.eaten).toBe(0);
  });

  it("derives the browser-local rolling date range ending today", () => {
    expect(getDashboardNutritionDateRange(new Date(2026, 2, 1, 12))).toEqual({
      startDate: "2026-02-23",
      endDate: "2026-03-01",
    });
  });
});
