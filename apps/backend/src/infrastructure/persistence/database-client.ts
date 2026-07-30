import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { DayLogsTable } from "./schemas/day-logs-table.js";
import { EmailOtpChallengesTable } from "./schemas/email-otp-challenges-table.js";
import { FoodEntriesTable } from "./schemas/food-entries-table.js";
import { SessionsTable } from "./schemas/sessions-table.js";
import { UsersTable } from "./schemas/users-table.js";

export interface Database {
  email_otp_challenges: EmailOtpChallengesTable;
  sessions: SessionsTable;
  users: UsersTable;
  food_entries: FoodEntriesTable;
  day_logs: DayLogsTable;
}

export interface DatabaseConnectionConfig {
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  maxConnections?: number;
}

export function createDatabase(config: DatabaseConnectionConfig): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        database: config.database,
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        max: config.maxConnections ?? 10,
      }),
    }),
  });
}
