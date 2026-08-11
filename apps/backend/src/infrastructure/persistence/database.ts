import { getRuntimeEnvironmentValue, isE2eRuntime } from "../runtime-environment.js";
import { createDatabaseClient, type DatabaseConnectionConfig } from "./database-client.js";

export * from "./database-client.js";

export function loadDatabaseConnectionConfigFromEnvironment(): DatabaseConnectionConfig {
  const config = {
    database: getRuntimeEnvironmentValue("DB_NAME"),
    host: getRuntimeEnvironmentValue("DB_HOST"),
    port: Number(getRuntimeEnvironmentValue("DB_PORT") || "5432"),
    user: getRuntimeEnvironmentValue("DB_USER"),
    password: getRuntimeEnvironmentValue("DB_PASSWORD"),
    maxConnections: 10,
  };

  if (
    isE2eRuntime() &&
    (!config.database || !config.host || !config.user || !config.password || !Number.isInteger(config.port))
  ) {
    throw new Error("E2E database configuration is incomplete");
  }

  return config as DatabaseConnectionConfig;
}

export const databaseClient = createDatabaseClient(loadDatabaseConnectionConfigFromEnvironment());
