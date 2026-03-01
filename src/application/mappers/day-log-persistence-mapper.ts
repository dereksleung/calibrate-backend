import { DayLog } from "@domain";
import { DayLogPersistenceDto } from "../dtos/day-log-dtos.js";
import { FoodEntryPersistenceMapper } from "./food-entry-persistence-mapper.js";

export class DayLogPersistenceMapper {
  static toDomain(dto: DayLogPersistenceDto): DayLog {
    return DayLog.reconstitute({
      id: dto.id,
      date: dto.date,
      breakfast:
        dto.breakfast?.map(FoodEntryPersistenceMapper.toDomain) ?? null,
      lunch: dto.lunch?.map(FoodEntryPersistenceMapper.toDomain) ?? null,
      dinner: dto.dinner?.map(FoodEntryPersistenceMapper.toDomain) ?? null,
      snacks: dto.snacks?.map(FoodEntryPersistenceMapper.toDomain) ?? null,
      weight: dto.weight,
    });
  }
}
