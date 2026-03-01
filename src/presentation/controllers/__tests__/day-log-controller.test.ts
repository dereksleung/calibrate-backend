import { DayLogController } from "src/presentation/controllers/day-log-controller.js";
import { DayLog, FoodEntry, MealNameEnum, MealNameEnumType } from "@domain";
import { DayLogServiceImpl } from "@application";
import {
  DayLogResponseMapper,
  GetDayLogRequestRouteParams,
} from "@presentation";
import { vi, MockedObject } from "vitest";
import { Request } from "express";

const getMockFoodEntry = (meal: MealNameEnumType): FoodEntry =>
  FoodEntry.reconstitute({
    id: "1",
    meal: meal,
    name: "Test Food",
    brand: "Test Brand",
    iconName: "test-icon",
    quantity: 1,
    quantityUnit: "g",
    calories: 100,
    totalFatGrams: 10,
    saturatedFatGrams: 10,
    cholesterolMg: 10,
    sodiumMg: 10,
    totalCarbohydrateGrams: 10,
    fiberGrams: 10,
    sugarGrams: 10,
    proteinGrams: 10,
  });

describe("DayLogController", () => {
  let dayLogController: DayLogController;
  let mockDayLogService: MockedObject<DayLogServiceImpl>;
  const mockDayLog: DayLog = DayLog.reconstitute({
    id: "123",
    date: new Date("2026-02-22T00:58:28.879Z"),
    breakfast: [getMockFoodEntry(MealNameEnum.BREAKFAST)],
    lunch: [getMockFoodEntry(MealNameEnum.LUNCH)],
    dinner: [getMockFoodEntry(MealNameEnum.DINNER)],
    snacks: [getMockFoodEntry(MealNameEnum.SNACKS)],
    weight: 140.1,
  });

  beforeEach(() => {
    mockDayLogService = {
      getLogForDay: vi.fn(),
      // any is acceptable here because this is a test file,
      // the type assertion will not spread beyond the test file and beforeEach handler.
    } as any;
    dayLogController = new DayLogController(mockDayLogService);
  });
  it("should get a log when given a valid ISO 8601 date", async () => {
    const req = {
      get: vi.fn(),
      params: {
        date: "2026-02-22T00:58:28.879Z",
      },
    } as unknown as Request<{ date: GetDayLogRequestRouteParams }>;

    mockDayLogService.getLogForDay.mockResolvedValue(mockDayLog);

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(mockDayLogService.getLogForDay).toHaveBeenCalledWith({
      userId: "default-user",
      date: "2026-02-22T00:58:28.879Z",
    });
    expect(res.status).toHaveBeenCalledWith(200);

    const response = DayLogResponseMapper.toResponse(mockDayLog);
    expect(res.json).toHaveBeenCalledWith(response);
  });
});
