import dotenvx from "@dotenvx/dotenvx";
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

const dialect = new PostgresDialect({
  pool: new Pool({
    database: dotenvx.get("DB_NAME"),
    host: dotenvx.get("DB_HOST"),
    port: Number(dotenvx.get("DB_PORT") || "5432"),
    user: dotenvx.get("DB_USER"),
    password: dotenvx.get("DB_PASSWORD"),
    max: 10,
  }),
});

export const createKyselyInstance = () => {
  return new Kysely<Database>({
    dialect,
  });
};

export const db = createKyselyInstance();
