import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";

import { DayLogsTable } from "./schemas/day-logs-table.js";
import { EmailOtpChallengesTable } from "./schemas/email-otp-challenges-table.js";
import { FoodCatalogTable } from "./schemas/food-catalog-table.js";
import { FoodEntriesTable } from "./schemas/food-entries-table.js";
import { PasskeyAuthenticationRateLimitEventsTable } from "./schemas/passkey-authentication-rate-limit-events-table.js";
import { PasskeyCredentialsTable } from "./schemas/passkey-credentials-table.js";
import { RefreshTokenGenerationsTable } from "./schemas/refresh-token-generations-table.js";
import { RememberedDeviceFamiliesTable } from "./schemas/remembered-device-families-table.js";
import { SecurityEventsTable } from "./schemas/security-events-table.js";
import { SessionsTable } from "./schemas/sessions-table.js";
import { SignupEnrollmentAuthorizationsTable } from "./schemas/signup-enrollment-authorizations-table.js";
import { UsersTable } from "./schemas/users-table.js";
import { WebauthnChallengesTable } from "./schemas/webauthn-challenges-table.js";

types.setTypeParser(types.builtins.DATE, (value: string) => value);
types.setTypeParser(types.builtins.NUMERIC, Number);

export interface DatabaseSchema {
  email_otp_challenges: EmailOtpChallengesTable;
  passkey_authentication_rate_limit_events: PasskeyAuthenticationRateLimitEventsTable;
  passkey_credentials: PasskeyCredentialsTable;
  refresh_token_generations: RefreshTokenGenerationsTable;
  remembered_device_families: RememberedDeviceFamiliesTable;
  security_events: SecurityEventsTable;
  sessions: SessionsTable;
  signup_enrollment_authorizations: SignupEnrollmentAuthorizationsTable;
  users: UsersTable;
  webauthn_challenges: WebauthnChallengesTable;
  food_entries: FoodEntriesTable;
  food_catalog: FoodCatalogTable;
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
