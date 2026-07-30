import type { Kysely } from "kysely";

import { sql } from "kysely";
import { inject } from "vitest";

import { createDatabase, type Database } from "../../src/infrastructure/persistence/database-client.js";
import { TEST_DATABASE_CONFIG, TEST_DATABASE_NAME } from "./database-context.js";

export function createIntegrationDatabase(): Kysely<Database> {
  const config = inject(TEST_DATABASE_CONFIG);

  if (config.database !== TEST_DATABASE_NAME) {
    throw new Error(`Refusing to use non-test database "${config.database}" in integration tests`);
  }

  return createDatabase(config);
}

export async function clearIntegrationDatabase(database: Kysely<Database>): Promise<void> {
  await sql`
    truncate table
      "sessions",
      "food_entries",
      "day_logs",
      "users",
      "email_otp_challenges"
    restart identity cascade
  `.execute(database);
}
