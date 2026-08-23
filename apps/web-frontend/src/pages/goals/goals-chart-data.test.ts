import type { DayLogRangeResponse, FoodEntryResponse } from "@calibrate/api-contracts";

import { describe, expect, it } from "vitest";

import { buildGoalsChartData } from "./goals-chart-data.ts";

const range = {
  startDate: "2026-08-06",
  endDate: "2026-08-12",
};

function buildFoodEntry(overrides: Partial<FoodEntryResponse> = {}): FoodEntryResponse {
  return {
    id: "food-entry-1",
    meal: "BREAKFAST",
    name: "Food",
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

describe("buildGoalsChartData", () => {
  it("derives chronological weekday labels, weight observations, and live fat totals", () => {
    const response = buildRangeResponse([
      {
        date: "2026-08-06",
        dayLog: {
          id: "day-log-1",
          date: "2026-08-06",
          breakfast: [buildFoodEntry({ totalFatGrams: 10 })],
          lunch: [buildFoodEntry({ id: "lunch-1", meal: "LUNCH", totalFatGrams: 20 })],
          dinner: [buildFoodEntry({ id: "dinner-1", meal: "DINNER", totalFatGrams: 30 })],
          snacks: [buildFoodEntry({ id: "snack-1", meal: "SNACKS", totalFatGrams: 40 })],
          weight: 180,
        },
      },
      { date: "2026-08-07", dayLog: null },
      {
        date: "2026-08-08",
        dayLog: {
          id: "day-log-2",
          date: "2026-08-08",
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
          weight: null,
        },
      },
      { date: "2026-08-09", dayLog: null },
      { date: "2026-08-10", dayLog: null },
      { date: "2026-08-11", dayLog: null },
      {
        date: "2026-08-12",
        dayLog: {
          id: "day-log-3",
          date: "2026-08-12",
          breakfast: [buildFoodEntry({ totalFatGrams: 5 })],
          lunch: [],
          dinner: [],
          snacks: [],
          weight: 178,
        },
      },
    ]);

    const chartData = buildGoalsChartData(response);

    expect(chartData.fat.map(({ label }) => label)).toEqual(["Th", "F", "Sa", "Sn", "M", "T", "W"]);
    expect(chartData.fat.map(({ eaten }) => eaten)).toEqual([100, null, 0, null, null, null, 5]);
    expect(chartData.fat.every(({ limit }) => limit === 60)).toBe(true);
    expect(chartData.weight.map(({ weight }) => weight)).toEqual([180, null, null, null, null, null, 178]);
    expect(chartData.weightChange).toBe(-2);
  });

  it("does not fabricate a weight change when fewer than two observations exist", () => {
    const response = buildRangeResponse([
      { date: "2026-08-06", dayLog: null },
      { date: "2026-08-07", dayLog: null },
      { date: "2026-08-08", dayLog: null },
      { date: "2026-08-09", dayLog: null },
      { date: "2026-08-10", dayLog: null },
      {
        date: "2026-08-11",
        dayLog: {
          id: "day-log-1",
          date: "2026-08-11",
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
          weight: 180,
        },
      },
      { date: "2026-08-12", dayLog: null },
    ]);

    expect(buildGoalsChartData(response).weightChange).toBeNull();
  });
});
