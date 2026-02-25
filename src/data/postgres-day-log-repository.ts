import { db } from "./database.js";
import { SelectableDayLog } from "./databaseSchemas/day-logs-table.js";
import { DayLogRepository } from "../services/ports/day-log-repository.js";
import { DayLog } from "@models/day-log.js";

export class PostgresDayLogRepository implements DayLogRepository {
  async findLogByDateAndUserId({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | undefined> {
    const dayLog: SelectableDayLog | undefined = await db
      .selectFrom("day_logs")
      .where("user_id", "=", userId)
      .where("date", "=", new Date(date))
      .executeTakeFirst();

    console.log("db dayLog:", dayLog);

    return dayLog;
  }
}
