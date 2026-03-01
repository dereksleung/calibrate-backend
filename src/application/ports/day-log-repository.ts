import {
  DayLogPersistenceDto,
  GetDayLogByDateAndUserDto,
} from "../dtos/day-log-dtos.js";

export interface DayLogRepository {
  findLogByDateAndUserId({
    userId,
    date,
  }: GetDayLogByDateAndUserDto): Promise<DayLogPersistenceDto | null>;
}
