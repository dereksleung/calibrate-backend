import { DayLog } from "@models/day-log.js";

export interface DayLogRepository {
  findLogByDateAndUserId({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | null>;
}
