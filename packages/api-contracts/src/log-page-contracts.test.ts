import { describe, expect, it } from "vitest";

import {
  CreateFoodEntryRequestSchema,
  CreateFoodEntryResponseSchema,
  FoodSearchRequestQuerySchema,
  FoodSearchResponseSchema,
  RecentFoodSearchResultSchema,
  DayLogRangeResponseSchema,
  DayLogSyncRequestSchema,
  DayLogSyncResponseSchema,
  GetDayLogRangeRequestQuerySchema,
  UpdateDayLogWeightRequestBodySchema,
  UpdateDayLogWeightRequestRouteParamsSchema,
  CatalogFoodSearchResultSchema,
} from "./index.js";

const baseFoodResult = {
  name: "Greek yogurt",
  brand: "Calibrate Kitchen",
  sourceLabel: "Recent",
  calories: 150,
  totalFatGrams: 4,
  saturatedFatGrams: 2,
  cholesterolMg: 10,
  sodiumMg: 65,
  totalCarbohydrateGrams: 8,
  fiberGrams: 0,
  sugarGrams: 6,
  proteinGrams: 18,
};

describe("log page request contracts", () => {
  it("accepts an ordered inclusive date range of up to seven days", () => {
    expect(
      GetDayLogRangeRequestQuerySchema.parse({
        startDate: "2026-08-06",
        endDate: "2026-08-12",
      }),
    ).toEqual({
      startDate: "2026-08-06",
      endDate: "2026-08-12",
    });
  });

  it("rejects malformed, missing, reversed, and overlong date ranges", () => {
    expect(() =>
      GetDayLogRangeRequestQuerySchema.parse({ startDate: "2026-8-06", endDate: "2026-08-12" }),
    ).toThrow();
    expect(() => GetDayLogRangeRequestQuerySchema.parse({ startDate: "2026-08-06" })).toThrow();
    expect(() =>
      GetDayLogRangeRequestQuerySchema.parse({ startDate: "2026-08-12", endDate: "2026-08-06" }),
    ).toThrow();
    expect(() =>
      GetDayLogRangeRequestQuerySchema.parse({ startDate: "2026-08-05", endDate: "2026-08-12" }),
    ).toThrow();
  });

  it("validates day-log weight updates by date and positive weight", () => {
    expect(UpdateDayLogWeightRequestRouteParamsSchema.parse({ date: "2026-05-20" })).toEqual({
      date: "2026-05-20",
    });

    expect(UpdateDayLogWeightRequestBodySchema.parse({ weight: 180.5 })).toEqual({ weight: 180.5 });
    expect(() => UpdateDayLogWeightRequestRouteParamsSchema.parse({ date: "05/20/2026" })).toThrow();
    expect(() => UpdateDayLogWeightRequestBodySchema.parse({ weight: 0 })).toThrow();
  });

  it("trims and bounds food search query params", () => {
    expect(FoodSearchRequestQuerySchema.parse({ query: "  yogurt  " })).toEqual({
      query: "yogurt",
      limit: 20,
    });
    expect(() => FoodSearchRequestQuerySchema.parse({ query: "   " })).toThrow();
    expect(() => FoodSearchRequestQuerySchema.parse({ query: "yo" })).toThrow();
    expect(() =>
      FoodSearchRequestQuerySchema.parse({ query: "one two three four five six seven eight nine" }),
    ).toThrow();
    expect(
      FoodSearchRequestQuerySchema.parse({ query: "greek yogurt", cursor: "offset:20", limit: "12" }),
    ).toEqual({
      query: "greek yogurt",
      cursor: "offset:20",
      limit: 12,
    });
  });

  it("uses the shared food entry base for create-food-entry requests", () => {
    const { sourceLabel: _sourceLabel, ...baseFoodEntry } = baseFoodResult;

    const result = CreateFoodEntryRequestSchema.parse({
      ...baseFoodEntry,
      meal: "BREAKFAST",
      chosenQuantity: 2,
      chosenUnit: "cups",
    });

    expect(result.chosenQuantity).toBe(2);
    expect(result.chosenUnit).toBe("cups");
    expect(result.quantityServing).toBe(1);
    expect(result.servingLabel).toBe("serving");
    expect(result.quantityMass).toBeNull();
    expect(result.massUnit).toBeNull();
    expect(result.quantityVolume).toBeNull();
    expect(result.volumeUnit).toBeNull();
  });
});

describe("log page response contracts", () => {
  const dayLogForDate = (date: string) => ({
    id: "00000000-0000-0000-0000-000000000000",
    date,
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
    weight: null,
  });

  const validRangeResponse = {
    startDate: "2026-08-06",
    endDate: "2026-08-12",
    days: [
      { date: "2026-08-06", dayLog: dayLogForDate("2026-08-06") },
      { date: "2026-08-07", dayLog: null },
      { date: "2026-08-08", dayLog: null },
      { date: "2026-08-09", dayLog: null },
      { date: "2026-08-10", dayLog: null },
      { date: "2026-08-11", dayLog: null },
      { date: "2026-08-12", dayLog: dayLogForDate("2026-08-12") },
    ],
  };

  it("accepts one consecutive date slot for every requested date", () => {
    expect(DayLogRangeResponseSchema.parse(validRangeResponse)).toEqual(validRangeResponse);
  });

  it("accepts a created food entry with its updated parent Day Log version", () => {
    const response = {
      id: "entry-1",
      meal: "LUNCH",
      name: "Greek yogurt",
      brand: "Calibrate Kitchen",
      calories: 150,
      totalFatGrams: 4,
      saturatedFatGrams: 2,
      cholesterolMg: 10,
      sodiumMg: 65,
      totalCarbohydrateGrams: 8,
      fiberGrams: 0,
      sugarGrams: 6,
      proteinGrams: 18,
      chosenQuantity: 1,
      chosenUnit: "serving",
      quantityServing: 1,
      servingLabel: "serving",
      quantityMass: null,
      massUnit: null,
      quantityVolume: null,
      volumeUnit: null,
      versionNumber: 2,
    };

    expect(CreateFoodEntryResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects date slots that are out of order, duplicated, or do not match the range", () => {
    expect(() =>
      DayLogRangeResponseSchema.parse({
        ...validRangeResponse,
        days: [validRangeResponse.days[1], validRangeResponse.days[0], ...validRangeResponse.days.slice(2)],
      }),
    ).toThrow();
    expect(() =>
      DayLogRangeResponseSchema.parse({
        ...validRangeResponse,
        days: [validRangeResponse.days[0], validRangeResponse.days[0], ...validRangeResponse.days.slice(2)],
      }),
    ).toThrow();
    expect(() =>
      DayLogRangeResponseSchema.parse({
        ...validRangeResponse,
        days: [{ date: "2026-08-05", dayLog: null }, ...validRangeResponse.days.slice(1)],
      }),
    ).toThrow();
  });

  it("defaults only serving fields for catalog results", () => {
    const result = CatalogFoodSearchResultSchema.parse({
      ...baseFoodResult,
      sourceLabel: "USDA FoodData Central",
      brand: null,
      source: "catalog",
      catalogFoodId: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
    });

    expect(result.quantityServing).toBe(1);
    expect(result.servingLabel).toBe("serving");
    expect(result.quantityMass).toBeNull();
    expect(result.massUnit).toBeNull();
    expect(result.quantityVolume).toBeNull();
    expect(result.volumeUnit).toBeNull();
  });

  it("accepts recent food results with compact recency metadata", () => {
    const result = RecentFoodSearchResultSchema.parse({
      ...baseFoodResult,
      source: "recent",
      foodEntryId: "food-entry-1",
      recency: {
        lastUsedDate: "2026-05-19",
        displayLabel: "Tue",
      },
    });

    expect(result.recency).toEqual({
      lastUsedDate: "2026-05-19",
      displayLabel: "Tue",
    });
  });

  it("models food search as one backend-ordered discriminated result list", () => {
    const response = FoodSearchResponseSchema.parse({
      results: [
        {
          ...baseFoodResult,
          source: "recent",
          foodEntryId: "food-entry-1",
          recency: {
            lastUsedDate: "2026-05-19",
            displayLabel: "Tue",
          },
        },
        {
          ...baseFoodResult,
          sourceLabel: "USDA FoodData Central",
          brand: null,
          source: "catalog",
          catalogFoodId: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
        },
      ],
      nextCursor: null,
    });

    expect(response.results.map((result) => result.source)).toEqual(["recent", "catalog"]);
    expect(response.nextCursor).toBeNull();
  });
});

describe("day log sync contracts", () => {
  const presentDayLog = {
    id: "00000000-0000-0000-0000-000000000000",
    date: "2026-08-06",
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
    weight: null,
  };

  it("accepts a contiguous inclusive range of at most 31 dates and a sparse known manifest", () => {
    expect(
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        known: {
          "2026-08-01": 2,
          "2026-08-02": null,
        },
      }),
    ).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      known: {
        "2026-08-01": 2,
        "2026-08-02": null,
      },
    });
  });

  it("accepts an empty known object for an entirely unloaded range", () => {
    expect(
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-06",
        endDate: "2026-08-06",
        known: {},
      }),
    ).toEqual({
      startDate: "2026-08-06",
      endDate: "2026-08-06",
      known: {},
    });
  });

  it("rejects malformed dates, reversed ranges, overlong ranges, and invalid known entries", () => {
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-8-01",
        endDate: "2026-08-07",
        known: {},
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-07",
        endDate: "2026-08-01",
        known: {},
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-01",
        endDate: "2026-09-01",
        known: {},
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        known: { "2026-07-31": 1 },
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        known: { "2026-08-01": 0 },
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncRequestSchema.parse({
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        known: { "2026-08-01": 2_147_483_648 },
      }),
    ).toThrow();
  });

  it("accepts sparse changed or unloaded slots, including Known-empty", () => {
    expect(
      DayLogSyncResponseSchema.parse({
        slots: [
          { date: "2026-08-06", versionNumber: 2, dayLog: presentDayLog },
          { date: "2026-08-07", versionNumber: null, dayLog: null },
        ],
      }),
    ).toEqual({
      slots: [
        { date: "2026-08-06", versionNumber: 2, dayLog: presentDayLog },
        { date: "2026-08-07", versionNumber: null, dayLog: null },
      ],
    });
  });

  it("rejects Known-empty slots with a version and present logs without one", () => {
    expect(() =>
      DayLogSyncResponseSchema.parse({
        slots: [{ date: "2026-08-06", versionNumber: 1, dayLog: null }],
      }),
    ).toThrow();
    expect(() =>
      DayLogSyncResponseSchema.parse({
        slots: [{ date: "2026-08-06", versionNumber: null, dayLog: presentDayLog }],
      }),
    ).toThrow();
  });
});
