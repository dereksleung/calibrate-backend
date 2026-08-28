import type { DayLogRangeResponse, FoodEntryResponse } from "@calibrate/api-contracts";

import { describe, expect, it } from "vitest";

import { buildGoalsChartData } from "./goals-chart-data.ts";

const range = {
  startDate: "2026-08-06",
  endDate: "2026-08-12",
};

/**
 * TO-DO:
 * - We should define a separate frontend "domain" type FoodEntry that represents the base 
 * fields that the front-end uses and can derive other data it needs for the UI from. 
 * This means we need a mapper function as well to transform the response to this domain type, 
 * we can put it in the same file right now as the useQuery hook that is specific to the 
 * API endpoint. The mapper function centralizes and limits the blast radius of any changes
 * to the API, so that they only need the mapper to change, instead of a lot of places in 
 * the UI. 
 * 
 * - The domain type should go in a Nx monorepo shared package called "frontend-core" 
 * and we should rename the api-client package to be this core package, "core" will 
 * more comfortably hold concepts like "domain", which likely will be the same type 
 * between the web and mobile frontends.
 * 
 * - Then, we can also define and DRY test mock builders inside either "frontend-core" 
 * for domain types, or "api-contracts" for response types.
 * 
 * - Architectural notes to add to agent context: for hooks like useGetDayLogs, 
 * instead of treating them like their main purpose is just running Tanstack Query to 
 * fetch and cache server state, treat them like application workflows that orchestrate
 * the operations needed for a user to achieve a result. For example, for the result of
 * getting day logs, useGetDayLogs would use the base React feature of custom hooks to
 * orchestrate further operations that truly always apply to getting day logs, like 
 * persisting the day logs in an offline store like IndexedDB for browsers, alongside 
 * what Tanstack Query does. This is sensible given upcoming planned offline store 
 * functionality, otherwise to keep things simpler, I would leave hooks like useGetDayLogs
 * just to be primarily about Tanstack Query.
 */

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
