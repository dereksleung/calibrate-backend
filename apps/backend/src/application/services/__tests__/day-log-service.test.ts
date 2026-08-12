import { IDayLogRepository } from "@application/ports/day-log-repository.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import { DayLogServiceImpl } from "@application/services/day-log-service.js";
import { DayLog } from "@domain/entities/day-log.js";
import { MealNameEnum } from "@domain/entities/food-entry.js";
import { buildDayLog } from "@factories/day-log.js";
import { buildFoodEntry } from "@factories/food-entry.js";
import { vi, MockedObject } from "vitest";

describe("DayLogServiceImpl", () => {
  let dayLogService: DayLogServiceImpl;
  let mockDayLogRepository: MockedObject<IDayLogRepository>;
  let mockUserRepository: MockedObject<IUserRepository>;
  const mockDayLog: DayLog = buildDayLog({
    id: "123",
    date: new Date("2026-02-22"),
    breakfast: [buildFoodEntry({ meal: MealNameEnum.BREAKFAST })],
    lunch: [buildFoodEntry({ meal: MealNameEnum.LUNCH })],
    dinner: [buildFoodEntry({ meal: MealNameEnum.DINNER })],
    snacks: [buildFoodEntry({ meal: MealNameEnum.SNACKS })],
    weight: 140.1,
  });

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
    } as any;
    mockDayLogRepository = {
      findLogByDateAndUserId: vi.fn(),
      findLogsByDateRangeAndUserId: vi.fn(),
      findOrCreateByDateAndUserId: vi.fn(),
    } as any;
    dayLogService = new DayLogServiceImpl(mockDayLogRepository, mockUserRepository);
  });

  describe("getLogForDay", () => {
    it("should return a day log when the repository finds one", async () => {
      mockDayLogRepository.findLogByDateAndUserId.mockResolvedValue(mockDayLog);

      const result = await dayLogService.getLogForDay({
        userId: "user-1",
        date: "2026-02-22",
      });

      expect(mockDayLogRepository.findLogByDateAndUserId).toHaveBeenCalledWith({
        userId: "user-1",
        date: "2026-02-22",
      });
      expect(result).toBe(mockDayLog);
    });

    it("should return null when the repository finds no log", async () => {
      mockDayLogRepository.findLogByDateAndUserId.mockResolvedValue(null);

      const result = await dayLogService.getLogForDay({
        userId: "user-1",
        date: "2026-02-22",
      });

      expect(mockDayLogRepository.findLogByDateAndUserId).toHaveBeenCalledWith({
        userId: "user-1",
        date: "2026-02-22",
      });
      expect(result).toBeNull();
    });

    it("should propagate errors thrown by the repository", async () => {
      mockDayLogRepository.findLogByDateAndUserId.mockRejectedValue(new Error("Database connection failed"));

      await expect(
        dayLogService.getLogForDay({
          userId: "user-1",
          date: "2026-02-22",
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("getLogsForDateRange", () => {
    it("delegates the authenticated user and inclusive bounds to the repository", async () => {
      mockDayLogRepository.findLogsByDateRangeAndUserId.mockResolvedValue([mockDayLog]);

      const result = await dayLogService.getLogsForDateRange({
        userId: "user-1",
        startDate: "2026-02-16",
        endDate: "2026-02-22",
      });

      expect(mockDayLogRepository.findLogsByDateRangeAndUserId).toHaveBeenCalledWith({
        userId: "user-1",
        startDate: "2026-02-16",
        endDate: "2026-02-22",
      });
      expect(result).toEqual([mockDayLog]);
    });

    it("propagates an empty repository result without creating day logs", async () => {
      mockDayLogRepository.findLogsByDateRangeAndUserId.mockResolvedValue([]);

      await expect(
        dayLogService.getLogsForDateRange({
          userId: "user-1",
          startDate: "2026-02-16",
          endDate: "2026-02-22",
        }),
      ).resolves.toEqual([]);

      expect(mockDayLogRepository.findOrCreateByDateAndUserId).not.toHaveBeenCalled();
    });

    it("propagates repository errors", async () => {
      mockDayLogRepository.findLogsByDateRangeAndUserId.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        dayLogService.getLogsForDateRange({
          userId: "user-1",
          startDate: "2026-02-16",
          endDate: "2026-02-22",
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
