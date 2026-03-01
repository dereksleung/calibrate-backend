import { DayLog } from "@domain";
import { GetDayLogByDateAndUserDto } from "../dtos/day-log-dtos.js";

export interface DayLogRepository {
  findLogByDateAndUserId({
    userId,
    date,
  }: GetDayLogByDateAndUserDto): Promise<DayLog | null>;
}
