import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { DayLogsTable } from "./schemas/day-logs-table.js";
import { EmailOtpChallengesTable } from "./schemas/email-otp-challenges-table.js";
import { FoodEntriesTable } from "./schemas/food-entries-table.js";
import { SessionsTable } from "./schemas/sessions-table.js";
import { SignupEnrollmentAuthorizationsTable } from "./schemas/signup-enrollment-authorizations-table.js";
import { UsersTable } from "./schemas/users-table.js";

export interface DatabaseSchema {
  email_otp_challenges: EmailOtpChallengesTable;
  sessions: SessionsTable;
  signup_enrollment_authorizations: SignupEnrollmentAuthorizationsTable;
  users: UsersTable;
  food_entries: FoodEntriesTable;
  day_logs: DayLogsTable;
}

export type DatabaseClient = Kysely<DatabaseSchema>;

export interface DatabaseConnectionConfig {
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  maxConnections?: number;
}

export function createDatabaseClient(config: DatabaseConnectionConfig): DatabaseClient {
  return new Kysely<DatabaseSchema>({
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
