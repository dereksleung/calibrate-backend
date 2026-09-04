import { DayLog } from "@domain/entities/day-log.js";
import { MealNameEnum } from "@domain/entities/food-entry.js";
import { buildDayLog, buildDayLogResponse } from "@factories/day-log.js";
import { buildFoodEntry, buildFoodEntryResponse } from "@factories/food-entry.js";
import { DayLogResponseMapper } from "src/presentation/mappers/day-log-response-mapper.js";

describe("DayLogResponseMapper", () => {
  it("should map a fully populated DayLog to a DayLogResponse", () => {
    const dayLog = buildDayLog({
      id: "123",
      date: Temporal.PlainDate.from("2026-02-22"),
      breakfast: [buildFoodEntry({ meal: MealNameEnum.BREAKFAST })],
      lunch: [buildFoodEntry({ meal: MealNameEnum.LUNCH })],
      dinner: [buildFoodEntry({ meal: MealNameEnum.DINNER })],
      snacks: [buildFoodEntry({ meal: MealNameEnum.SNACKS })],
      weight: 140.1,
    });

    const result = DayLogResponseMapper.toResponse(dayLog);

    expect(result).toEqual(
      buildDayLogResponse({
        id: "123",
        date: "2026-02-22",
        breakfast: [buildFoodEntryResponse({ meal: MealNameEnum.BREAKFAST })],
        lunch: [buildFoodEntryResponse({ meal: MealNameEnum.LUNCH })],
        dinner: [buildFoodEntryResponse({ meal: MealNameEnum.DINNER })],
        snacks: [buildFoodEntryResponse({ meal: MealNameEnum.SNACKS })],
        weight: 140.1,
      }),
    );
  });

  it("should handle a mix of populated and empty meals", () => {
    const dayLog = DayLog.reconstitute({
      id: "789",
      date: Temporal.PlainDate.from("2026-03-01"),
      breakfast: [buildFoodEntry({ meal: MealNameEnum.BREAKFAST })],
      lunch: [],
      dinner: [buildFoodEntry({ meal: MealNameEnum.DINNER })],
      snacks: [],
      weight: 155.0,
      versionNumber: 1,
    });

    const result = DayLogResponseMapper.toResponse(dayLog);

    expect(result).toEqual(
      buildDayLogResponse({
        id: "789",
        date: "2026-03-01",
        breakfast: [buildFoodEntryResponse({ meal: MealNameEnum.BREAKFAST })],
        lunch: [],
        dinner: [buildFoodEntryResponse({ meal: MealNameEnum.DINNER })],
        snacks: [],
        weight: 155.0,
      }),
    );
  });

  it("should map empty meal arrays to empty arrays", () => {
    const dayLog = DayLog.reconstitute({
      id: "101",
      date: Temporal.PlainDate.from("2026-03-01"),
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      weight: null,
      versionNumber: 1,
    });

    const result = DayLogResponseMapper.toResponse(dayLog);

    expect(result).toEqual(
      buildDayLogResponse({
        id: "101",
        date: "2026-03-01",
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
        weight: null,
      }),
    );
  });

  it("should map multiple food entries per meal", () => {
    const breakfastEntries = [
      buildFoodEntry({ meal: MealNameEnum.BREAKFAST }),
      buildFoodEntry({ meal: MealNameEnum.BREAKFAST }),
    ];

    const dayLog = buildDayLog({
      id: "202",
      date: Temporal.PlainDate.from("2026-03-01"),
      breakfast: breakfastEntries,
      lunch: [],
      dinner: [],
      snacks: [],
      weight: null,
    });

    const result = DayLogResponseMapper.toResponse(dayLog);

    expect(result).toEqual(
      buildDayLogResponse({
        id: "202",
        date: "2026-03-01",
        breakfast: [
          buildFoodEntryResponse({ meal: MealNameEnum.BREAKFAST }),
          buildFoodEntryResponse({ meal: MealNameEnum.BREAKFAST }),
        ],
        lunch: [],
        dinner: [],
        snacks: [],
        weight: null,
      }),
    );
  });
});
