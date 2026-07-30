import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { FileMigrationProvider, Migrator } from "kysely";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createDatabase,
  type DatabaseConnectionConfig,
} from "../../src/infrastructure/persistence/database-client.js";
import { TEST_DATABASE_CONFIG, TEST_DATABASE_NAME } from "./database-context.js";

const POSTGRES_IMAGE = "postgres:18";
const MIGRATION_FOLDER = path.resolve(import.meta.dirname, "../../src/infrastructure/persistence/migrations");

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  const password = randomBytes(24).toString("base64url");
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(TEST_DATABASE_NAME)
    .withUsername("calibrate_test")
    .withPassword(password)
    .start();

  const databaseConfig: DatabaseConnectionConfig = {
    database: container.getDatabase(),
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    maxConnections: 10,
  };
  const database = createDatabase(databaseConfig);

  try {
    const migrator = new Migrator({
      db: database,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: MIGRATION_FOLDER,
      }),
    });
    const { error } = await migrator.migrateToLatest();

    if (error) {
      throw error;
    }

    project.provide(TEST_DATABASE_CONFIG, databaseConfig);
  } catch (error) {
    await container.stop();
    container = undefined;
    throw error;
  } finally {
    await database.destroy();
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
}
