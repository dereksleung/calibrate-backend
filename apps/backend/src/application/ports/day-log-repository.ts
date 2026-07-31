import { DayLog } from "@domain/entities/day-log.js";
import { FoodEntry } from "@domain/entities/food-entry.js";

import {
  FindOrCreateDayLogByDateAndUserIdRepositoryDto,
  GetDayLogByDateAndUserDto,
} from "../dtos/day-log-dtos.js";

export interface IDayLogRepository {
  findLogByDateAndUserId({ userId, date }: GetDayLogByDateAndUserDto): Promise<DayLog | null>;

  findOrCreateByDateAndUserId({
    date,
    userId,
  }: FindOrCreateDayLogByDateAndUserIdRepositoryDto): Promise<DayLog>;

  addFoodEntry(dayLogId: string, foodEntry: FoodEntry): Promise<FoodEntry>;

  countDayLogsByUserId(userId: string): Promise<number>;
}
