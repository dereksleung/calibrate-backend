import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DayLogsTable } from "./schemas/day-logs-table.js";
import { FoodEntriesTable } from "./schemas/food-entries-table.js";
import { UsersTable } from "./schemas/users-table.js";

export interface Database {
  users: UsersTable;
  food_entries: FoodEntriesTable;
  day_logs: DayLogsTable;
}

const dialect = new PostgresDialect({
  pool: new Pool({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
  }),
});

export const createKyselyInstance = () => {
  return new Kysely<Database>({
    dialect,
  });
};

export const db = createKyselyInstance();
