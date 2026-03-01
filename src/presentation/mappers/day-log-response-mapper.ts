import { FoodEntryResponseMapper } from "./food-entry-response-mapper.js";
import { DayLog } from "@domain";
import { DayLogResponse } from "../http/day-log-responses.js";

export class DayLogResponseMapper {
  public static toResponse(dayLog: DayLog): DayLogResponse {
    return {
      id: dayLog.id,
      date: dayLog.date,
      breakfast:
        dayLog.breakfast?.map(FoodEntryResponseMapper.toResponse) ?? null,
      lunch: dayLog.lunch?.map(FoodEntryResponseMapper.toResponse) ?? null,
      dinner: dayLog.dinner?.map(FoodEntryResponseMapper.toResponse) ?? null,
      snacks: dayLog.snacks?.map(FoodEntryResponseMapper.toResponse) ?? null,
      weight: dayLog.weight,
    };
  }
}
