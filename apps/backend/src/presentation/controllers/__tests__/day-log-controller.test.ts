import type { CreateFoodEntryRequestRouteParams } from "@calibrate/api-contracts";

import { DayLogServiceImpl } from "@application/services/day-log-service.js";
import {
  DayLogRangeResponse,
  DayLogResponse,
  DayLogSyncRequest,
  GetDayLogRangeRequestQuery,
  GetDayLogRequestRouteParams,
} from "@calibrate/api-contracts";
import { DayLog } from "@domain/entities/day-log.js";
import { MealNameEnum } from "@domain/entities/food-entry.js";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";
import { buildDayLogResponse } from "@factories/day-log.js";
import { buildFoodEntry, buildFoodEntryResponse } from "@factories/food-entry.js";
import { Request } from "express";
import { DayLogController } from "src/presentation/controllers/day-log-controller.js";
import { vi, MockedObject } from "vitest";

describe("DayLogController", () => {
  let dayLogController: DayLogController;
  let mockDayLogService: MockedObject<DayLogServiceImpl>;
  const mockDayLog: DayLog = DayLog.reconstitute({
    id: "123",
    date: Temporal.PlainDate.from("2026-02-22"),
    breakfast: [buildFoodEntry({ meal: MealNameEnum.BREAKFAST })],
    lunch: [buildFoodEntry({ meal: MealNameEnum.LUNCH })],
    dinner: [buildFoodEntry({ meal: MealNameEnum.DINNER })],
    snacks: [buildFoodEntry({ meal: MealNameEnum.SNACKS })],
    weight: 140.1,
    versionNumber: 1,
  });
  const mockDayLogResponse: DayLogResponse = buildDayLogResponse({
    id: "123",
    date: "2026-02-22",
    breakfast: [buildFoodEntryResponse({ meal: MealNameEnum.BREAKFAST })],
    lunch: [buildFoodEntryResponse({ meal: MealNameEnum.LUNCH })],
    dinner: [buildFoodEntryResponse({ meal: MealNameEnum.DINNER })],
    snacks: [buildFoodEntryResponse({ meal: MealNameEnum.SNACKS })],
    weight: 140.1,
  });
  const mockCreateFoodEntryRequestBody = {
    meal: MealNameEnum.BREAKFAST,
    name: "Scrambled Eggs",
    brand: null,
    calories: 180,
    totalFatGrams: 12,
    saturatedFatGrams: 4,
    cholesterolMg: 370,
    sodiumMg: 140,
    totalCarbohydrateGrams: 2,
    fiberGrams: 0,
    sugarGrams: 1,
    proteinGrams: 14,
    chosenQuantity: 2,
    chosenUnit: "pieces",
    quantityServing: 1,
    servingLabel: "serving",
    quantityMass: null,
    massUnit: null,
    quantityVolume: null,
    volumeUnit: null,
  };
  const mockCreateFoodEntryServiceInput = {
    meal: MealNameEnum.BREAKFAST,
    name: "Scrambled Eggs",
    brand: null,
    iconName: null,
    chosenQuantity: 2,
    chosenUnit: "pieces",
    quantityServing: 1,
    servingLabel: "serving",
    quantityMass: null,
    massUnit: null,
    quantityVolume: null,
    volumeUnit: null,
    calories: 180,
    totalFatGrams: 12,
    saturatedFatGrams: 4,
    cholesterolMg: 370,
    sodiumMg: 140,
    totalCarbohydrateGrams: 2,
    fiberGrams: 0,
    sugarGrams: 1,
    proteinGrams: 14,
  };

  beforeEach(() => {
    mockDayLogService = {
      getLogForDay: vi.fn(),
      getLogsForDateRange: vi.fn(),
      syncLogsForDateRange: vi.fn(),
      addFoodEntry: vi.fn(),
      // any is acceptable here because this is a test file,
      // the type assertion will not spread beyond the test file and beforeEach handler.
    } as any;
    dayLogController = new DayLogController(mockDayLogService);
  });

  it("should get a log when given a valid YYYY-MM-DD date", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockResolvedValue(mockDayLog);

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(mockDayLogService.getLogForDay).toHaveBeenCalledWith({
      userId: "user-1",
      date: "2026-02-22",
    });
    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(mockDayLogResponse);
  });

  it("should return 400 when date param is invalid", async () => {
    const req = {
      get: vi.fn(),
      params: {
        date: "not-a-date",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(mockDayLogService.getLogForDay).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        details: expect.any(Array),
      }),
    );
  });

  it("should return 404 when service throws a 'not found' error", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockRejectedValue(new Error("Resource not found"));

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Resource not found" });
  });

  it("should return 403 when service throws a 'permission' error", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockRejectedValue(new Error("Insufficient permission for this resource"));

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Permission denied" });
  });

  it("should return 500 with error message for all other Errors", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockRejectedValue(new Error("Database connection failed"));

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Database connection failed",
    });
  });

  it("should return 500 with generic message for non-Error throw", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockRejectedValue("some string error");

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "An unknown error occurred",
    });
  });

  it("should return 200 with null when service returns null", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockResolvedValue(null);

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(null);
  });

  it("returns every requested date slot with nulls for missing logs", async () => {
    const req = {
      auth: { userId: "user-1" },
      query: { startDate: "2026-02-16", endDate: "2026-02-22" },
    } as unknown as Request<Record<string, never>, unknown, unknown, GetDayLogRangeRequestQuery>;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const expectedResponse: DayLogRangeResponse = {
      startDate: "2026-02-16",
      endDate: "2026-02-22",
      days: [
        { date: "2026-02-16", dayLog: null },
        { date: "2026-02-17", dayLog: null },
        { date: "2026-02-18", dayLog: null },
        { date: "2026-02-19", dayLog: null },
        { date: "2026-02-20", dayLog: null },
        { date: "2026-02-21", dayLog: null },
        { date: "2026-02-22", dayLog: mockDayLogResponse },
      ],
    };
    mockDayLogService.getLogsForDateRange.mockResolvedValue([mockDayLog]);

    await dayLogController.getLogsForDateRange(req, res);

    expect(mockDayLogService.getLogsForDateRange).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-02-16",
      endDate: "2026-02-22",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expectedResponse);
  });

  it("rejects an invalid date range before calling the service", async () => {
    const req = {
      auth: { userId: "user-1" },
      query: { startDate: "2026-02-22", endDate: "2026-02-16" },
    } as unknown as Request<Record<string, never>, unknown, unknown, GetDayLogRangeRequestQuery>;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogsForDateRange(req, res);

    expect(mockDayLogService.getLogsForDateRange).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 400 when service throws a BusinessLogicError", async () => {
    const req = {
      get: vi.fn(),
      auth: {
        userId: "user-1",
      },
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;

    mockDayLogService.getLogForDay.mockRejectedValue(new BusinessLogicError("Invalid date"));

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid date" });
  });

  it("should create a food entry when request body is valid", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    const createdFoodEntry = buildFoodEntry({
      dayLogId: "123",
      meal: MealNameEnum.BREAKFAST,
      name: "Scrambled Eggs",
      brand: null,
      iconName: null,
      chosenQuantity: 2,
      chosenUnit: "pieces",
      quantityServing: 1,
      servingLabel: "serving",
      quantityMass: null,
      massUnit: null,
      quantityVolume: null,
      volumeUnit: null,
      calories: 180,
      totalFatGrams: 12,
      saturatedFatGrams: 4,
      cholesterolMg: 370,
      sodiumMg: 140,
      totalCarbohydrateGrams: 2,
      fiberGrams: 0,
      sugarGrams: 1,
      proteinGrams: 14,
    });
    mockDayLogService.addFoodEntry.mockResolvedValue({
      foodEntry: createdFoodEntry,
      versionNumber: 2,
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(mockDayLogService.addFoodEntry).toHaveBeenCalledWith({
      userId: "user-1",
      date: "2026-02-22",
      foodEntry: mockCreateFoodEntryServiceInput,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      {
        ...buildFoodEntryResponse({
          id: createdFoodEntry.id,
          meal: MealNameEnum.BREAKFAST,
          name: "Scrambled Eggs",
          brand: null,
          calories: 180,
          totalFatGrams: 12,
          saturatedFatGrams: 4,
          cholesterolMg: 370,
          sodiumMg: 140,
          totalCarbohydrateGrams: 2,
          fiberGrams: 0,
          sugarGrams: 1,
          proteinGrams: 14,
          chosenQuantity: 2,
          chosenUnit: "pieces",
          quantityServing: 1,
          servingLabel: "serving",
        }),
        versionNumber: 2,
      },
    );
  });

  it("should return 400 when date param is invalid", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "not-a-date",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        details: expect.any(Array),
      }),
    );
  });

  it("should return 400 when createFoodEntry body is invalid", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: {
        meal: MealNameEnum.BREAKFAST,
        name: "Scrambled Eggs",
        brand: null,
      },
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(mockDayLogService.addFoodEntry).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        details: expect.any(Array),
      }),
    );
  });

  it("should return 404 when createFoodEntry service throws a 'not found' error", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    mockDayLogService.addFoodEntry.mockRejectedValue(new Error("Resource not found"));
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Resource not found" });
  });

  it("should return 403 when createFoodEntry service throws a 'permission' error", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    mockDayLogService.addFoodEntry.mockRejectedValue(new Error("Insufficient permission for this resource"));
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Permission denied" });
  });

  it("should return 500 with error message when createFoodEntry service throws generic Error", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    mockDayLogService.addFoodEntry.mockRejectedValue(new Error("Database connection failed"));
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Database connection failed" });
  });

  it("should return 500 with generic message when createFoodEntry service throws non-Error", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    mockDayLogService.addFoodEntry.mockRejectedValue("some string error");
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "An unknown error occurred" });
  });

  it("should return 400 when createFoodEntry service throws BusinessLogicError", async () => {
    const req = {
      auth: {
        userId: "user-1",
      },
      body: mockCreateFoodEntryRequestBody,
      params: {
        date: "2026-02-22",
      } as unknown as CreateFoodEntryRequestRouteParams,
    } as unknown as Request<CreateFoodEntryRequestRouteParams>;
    mockDayLogService.addFoodEntry.mockRejectedValue(new BusinessLogicError("Invalid input"));
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.createFoodEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
  });

  it("should return 401 when getLogForDay is called without authenticated user context", async () => {
    const req = {
      get: vi.fn(),
      params: {
        date: "2026-02-22",
      },
    } as unknown as Request<GetDayLogRequestRouteParams>;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await dayLogController.getLogForDay(req, res);

    expect(mockDayLogService.getLogForDay).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
  });

  it("returns a no-store 204 when the requested range already matches", async () => {
    const req = {
      auth: { userId: "user-1" },
      body: {
        startDate: "2026-08-06",
        endDate: "2026-08-07",
        known: { "2026-08-06": 1, "2026-08-07": null },
      },
    } as unknown as Request<Record<string, never>, unknown, DayLogSyncRequest>;
    const res = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    } as any;
    mockDayLogService.syncLogsForDateRange.mockResolvedValue({ status: "unchanged" });

    await dayLogController.syncLogsForDateRange(req, res);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mockDayLogService.syncLogsForDateRange).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-08-06",
      endDate: "2026-08-07",
      known: { "2026-08-06": 1, "2026-08-07": null },
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns sparse no-store 200 slots for changed or unloaded dates", async () => {
    const req = {
      auth: { userId: "user-1" },
      body: {
        startDate: "2026-08-06",
        endDate: "2026-08-07",
        known: {},
      },
    } as unknown as Request<Record<string, never>, unknown, DayLogSyncRequest>;
    const res = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    } as any;
    mockDayLogService.syncLogsForDateRange.mockResolvedValue({
      status: "changed",
      slots: [
        { date: "2026-08-06", versionNumber: 1, dayLog: mockDayLog },
        { date: "2026-08-07", versionNumber: null, dayLog: null },
      ],
    });

    await dayLogController.syncLogsForDateRange(req, res);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      slots: [
        { date: "2026-08-06", versionNumber: 1, dayLog: mockDayLogResponse },
        { date: "2026-08-07", versionNumber: null, dayLog: null },
      ],
    });
  });

  it("rejects an overlong or malformed sync range before calling the service", async () => {
    const req = {
      auth: { userId: "user-1" },
      body: {
        startDate: "2026-08-01",
        endDate: "2026-09-01",
        known: {},
      },
    } as unknown as Request<Record<string, never>, unknown, DayLogSyncRequest>;
    const res = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
    } as any;

    await dayLogController.syncLogsForDateRange(req, res);

    expect(mockDayLogService.syncLogsForDateRange).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
