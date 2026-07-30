import type { DatabaseConnectionConfig } from "../../src/infrastructure/persistence/database-client.js";

export const TEST_DATABASE_CONFIG = "databaseConfig";
export const TEST_DATABASE_NAME = "calibrate_test";

declare module "vitest" {
  export interface ProvidedContext {
    databaseConfig: DatabaseConnectionConfig;
  }
}
