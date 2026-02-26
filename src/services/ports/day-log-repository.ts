import { DayLog } from "@models";

export interface DayLogRepository {
  findLogByDateAndUserId({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | null>;
}
