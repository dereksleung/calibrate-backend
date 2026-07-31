import { DayLog, DayLogProps } from "@domain/entities/day-log.js";
import { DayLogResponse } from "@presentation";

export const buildDayLog = (overrides: Partial<DayLogProps> = {}): DayLog =>
  DayLog.reconstitute({
    id: overrides.id ?? "1",
    date: overrides.date ?? new Date(),
    breakfast: overrides.breakfast ?? [],
    lunch: overrides.lunch ?? [],
    dinner: overrides.dinner ?? [],
    snacks: overrides.snacks ?? [],
    weight: overrides.weight ?? null,
  });

export const buildDayLogResponse = (overrides: Partial<DayLogResponse> = {}): DayLogResponse => {
  return {
    id: "1",
    date: '2026-02-22',
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
    weight: null,
    ...overrides,
  };
};
