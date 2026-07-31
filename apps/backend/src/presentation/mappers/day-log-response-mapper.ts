import type { DayLogResponse } from "@calibrate/api-contracts";

import { DayLog } from "@domain/entities/day-log.js";

import { FoodEntryResponseMapper } from "./food-entry-response-mapper.js";

export class DayLogResponseMapper {
  public static toResponse(dayLog: DayLog): DayLogResponse {
    return {
      id: dayLog.id,
      date: dayLog.date.toString(),
      breakfast: dayLog.breakfast?.map(FoodEntryResponseMapper.toResponse) ?? null,
      lunch: dayLog.lunch?.map(FoodEntryResponseMapper.toResponse) ?? null,
      dinner: dayLog.dinner?.map(FoodEntryResponseMapper.toResponse) ?? null,
      snacks: dayLog.snacks?.map(FoodEntryResponseMapper.toResponse) ?? null,
      weight: dayLog.weight,
    };
  }
}
