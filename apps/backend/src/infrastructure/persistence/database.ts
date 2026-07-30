import dotenvx from "@dotenvx/dotenvx";

import { createDatabaseClient, type DatabaseConnectionConfig } from "./database-client.js";

export * from "./database-client.js";

export function loadDatabaseConnectionConfigFromEnvironment(): DatabaseConnectionConfig {
  return {
    database: dotenvx.get("DB_NAME"),
    host: dotenvx.get("DB_HOST"),
    port: Number(dotenvx.get("DB_PORT") || "5432"),
    user: dotenvx.get("DB_USER"),
    password: dotenvx.get("DB_PASSWORD"),
    maxConnections: 10,
  };
}

export const databaseClient = createDatabaseClient(loadDatabaseConnectionConfigFromEnvironment());
