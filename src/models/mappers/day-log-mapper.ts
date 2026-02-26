import { DayLogResponse } from "../http/day-log-responses.js";
import { DayLog } from "../domain/day-log.js";
import { FoodEntryMapper } from "./food-entry-mapper.js";

export class DayLogMapper {
  public static toResponse(dayLog: DayLog): DayLogResponse {
    return {
      id: dayLog.id,
      date: dayLog.date,
      breakfast: dayLog.breakfast?.map(FoodEntryMapper.toResponse) ?? null,
      lunch: dayLog.lunch?.map(FoodEntryMapper.toResponse) ?? null,
      dinner: dayLog.dinner?.map(FoodEntryMapper.toResponse) ?? null,
      snacks: dayLog.snacks?.map(FoodEntryMapper.toResponse) ?? null,
      weight: dayLog.weight,
    };
  }
}
