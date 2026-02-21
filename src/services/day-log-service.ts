import { DayLog } from "@models/day-log.js";

export interface DayLogService {
  getLogForDay(date: Date): Promise<DayLog>;
}