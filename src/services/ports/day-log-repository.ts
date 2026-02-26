import { DayLogPersistenceDto, GetDayLogByDateAndUserDto } from "@models";

export interface DayLogRepository {
  findLogByDateAndUserId({
    userId,
    date,
  }: GetDayLogByDateAndUserDto): Promise<DayLogPersistenceDto | null>;
}
