import type { DayLog } from "@domain/entities/day-log.js";
import type { FoodEntry } from "@domain/entities/food-entry.js";

export interface FindDayLogByDateAndUserInput {
  userId: string;
  date: string;
}

export interface FindOrCreateDayLogByDateAndUserInput {
  date: string;
  userId: string;
}

export interface IDayLogRepository {
  findLogByDateAndUserId({ userId, date }: FindDayLogByDateAndUserInput): Promise<DayLog | null>;

  findOrCreateByDateAndUserId({
    date,
    userId,
  }: FindOrCreateDayLogByDateAndUserInput): Promise<DayLog>;

  addFoodEntry(dayLogId: string, foodEntry: FoodEntry): Promise<FoodEntry>;

  countDayLogsByUserId(userId: string): Promise<number>;
}
