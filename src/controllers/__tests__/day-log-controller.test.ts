import { DayLogController } from "@controllers/day-log-controller.js";
import { DayLog, GetDayLogRequestRouteParams } from "@models/day-log.js";
import { DayLogService, DayLogServiceImpl } from "@services/day-log-service.js";
import { vi, MockedObject } from "vitest";
import { Request } from "express";

describe("DayLogController", () => {
  let dayLogController: DayLogController;
  let mockDayLogService: MockedObject<DayLogServiceImpl>;
  const mockDayLog: DayLog = {
    id: "123",
    date: "2026-02-22T00:58:28.879Z",
    breakfast: {
      id: "1",
      name: "Breakfast",
      foods: [],
    },
    lunch: {
      id: "2",
      name: "Lunch",
      foods: [],
    },
    dinner: {
      id: "3",
      name: "Dinner",
      foods: [],
    },
    snacks: {
      id: "4",
      name: "Snacks",
      foods: [],
    },
    weight: 140.1,
  };

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
    expect(res.json).toHaveBeenCalledWith(mockDayLog);
  });
});
