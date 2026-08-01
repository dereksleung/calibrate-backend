import { sql } from "kysely";
import { inject } from "vitest";

import {
  createDatabaseClient,
  type DatabaseClient,
} from "../../src/infrastructure/persistence/database-client.js";
import { TEST_DATABASE_CONFIG, TEST_DATABASE_NAME } from "./database-context.js";

export function createIntegrationDatabaseClient(): DatabaseClient {
  const config = inject(TEST_DATABASE_CONFIG);

  if (config.database !== TEST_DATABASE_NAME) {
    throw new Error(`Refusing to use non-test database "${config.database}" in integration tests`);
  }

  return createDatabaseClient(config);
}

export async function clearIntegrationDatabase(databaseClient: DatabaseClient): Promise<void> {
  await sql`
    truncate table
      "security_events",
      "sessions",
      "refresh_token_generations",
      "remembered_device_families",
      "passkey_credentials",
      "webauthn_challenges",
      "signup_enrollment_authorizations",
      "food_entries",
      "day_logs",
      "users",
      "email_otp_challenges"
    restart identity cascade
  `.execute(databaseClient);
}
