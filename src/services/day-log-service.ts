import { DayLog } from "@models/day-log.js";

export interface DayLogService {
  getLogForDay({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog>;
}

export class DayLogService implements DayLogService {
  async getLogForDay({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog> {
    // stub
    return {
      userId,
      date,
    };
  }
}
