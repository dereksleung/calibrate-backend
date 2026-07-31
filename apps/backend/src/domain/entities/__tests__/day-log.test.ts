import { MealNameEnum } from "@domain/entities/food-entry.js";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";
import { buildDayLog, buildFoodEntry } from "@factories";
import { describe, it, expect } from "vitest";

describe("DayLog", () => {
  describe("reconstitute", () => {
    it("returns a DayLog with the correct properties", () => {
      const date = new Date("2026-01-15");
      const dayLog = buildDayLog({ id: "abc", date, weight: 75.5 });

      expect(dayLog.id).toBe("abc");
      expect(dayLog.date).toEqual(Temporal.PlainDate.from({
        year: 2026,
        month: 1,
        day: 15,
      }));
      expect(dayLog.weight).toBe(75.5);
      expect(dayLog.breakfast).toEqual([]);
      expect(dayLog.lunch).toEqual([]);
      expect(dayLog.dinner).toEqual([]);
      expect(dayLog.snacks).toEqual([]);
    });

    it("stores weight as null when not provided", () => {
      const dayLog = buildDayLog({ weight: null });

      expect(dayLog.weight).toBeNull();
    });
  });

  describe("addFoodEntry", () => {
    it("adds a breakfast entry to the breakfast meal", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.BREAKFAST });

      dayLog.addFoodEntry(entry);

      expect(dayLog.breakfast).toHaveLength(1);
      expect(dayLog.breakfast).toContain(entry);
    });

    it("adds a lunch entry to the lunch meal", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.LUNCH });

      dayLog.addFoodEntry(entry);

      expect(dayLog.lunch).toHaveLength(1);
      expect(dayLog.lunch).toContain(entry);
    });

    it("adds a dinner entry to the dinner meal", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.DINNER });

      dayLog.addFoodEntry(entry);

      expect(dayLog.dinner).toHaveLength(1);
      expect(dayLog.dinner).toContain(entry);
    });

    it("adds a snacks entry to the snacks meal", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.SNACKS });

      dayLog.addFoodEntry(entry);

      expect(dayLog.snacks).toHaveLength(1);
      expect(dayLog.snacks).toContain(entry);
    });

    it("returns the added food entry", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.BREAKFAST });

      const result = dayLog.addFoodEntry(entry);

      expect(result).toBe(entry);
    });

    it("does not affect other meals when adding to one meal", () => {
      const dayLog = buildDayLog();
      const entry = buildFoodEntry({ meal: MealNameEnum.BREAKFAST });

      dayLog.addFoodEntry(entry);

      expect(dayLog.lunch).toHaveLength(0);
      expect(dayLog.dinner).toHaveLength(0);
      expect(dayLog.snacks).toHaveLength(0);
    });

    it("allows up to 25 entries in a meal", () => {
      const entries = Array.from({ length: 25 }, (_, i) =>
        buildFoodEntry({ id: String(i), meal: MealNameEnum.BREAKFAST }),
      );
      const dayLog = buildDayLog({ breakfast: entries.slice(0, 24) });

      expect(() => dayLog.addFoodEntry(entries[24])).not.toThrow();
      expect(dayLog.breakfast).toHaveLength(25);
    });

    it("throws a BusinessLogicError when a meal already has 25 entries and another is added", () => {
      const entries = Array.from({ length: 25 }, (_, i) =>
        buildFoodEntry({ id: String(i), meal: MealNameEnum.LUNCH }),
      );
      const dayLog = buildDayLog({ lunch: entries });
      const extraEntry = buildFoodEntry({
        id: "extra",
        meal: MealNameEnum.LUNCH,
      });

      expect(() => dayLog.addFoodEntry(extraEntry)).toThrow(BusinessLogicError);
      expect(() => dayLog.addFoodEntry(extraEntry)).toThrow("Meal cannot exceed 25 food entries");
    });

    it("enforces the 25-entry limit independently per meal", () => {
      const lunchEntries = Array.from({ length: 25 }, (_, i) =>
        buildFoodEntry({ id: String(i), meal: MealNameEnum.LUNCH }),
      );
      const dayLog = buildDayLog({ lunch: lunchEntries });
      const breakfastEntry = buildFoodEntry({ meal: MealNameEnum.BREAKFAST });

      // Lunch is full, but breakfast should still accept entries
      expect(() => dayLog.addFoodEntry(breakfastEntry)).not.toThrow();
    });
  });
});
