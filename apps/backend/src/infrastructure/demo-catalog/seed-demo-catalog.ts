import path from "node:path";

import { createDatabaseClient } from "../persistence/database-client.js";
import { getRuntimeEnvironmentValue } from "../runtime-environment.js";
import {
  formatFoundationFoodsSeedSummary,
  seedFoundationFoodsCatalog,
} from "./foundation-foods-catalog-seeder.js";
import {
  defaultFoundationFoodsArchivePath,
  defaultFoundationFoodsManifestPath,
  readFoundationFoodsManifest,
} from "./foundation-foods-source.js";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../../..");

function requireConfigValue(name: string): string {
  const value = getRuntimeEnvironmentValue(name);
  if (!value) throw new Error(`Missing required database configuration: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const databaseClient = createDatabaseClient({
    database: requireConfigValue("DB_NAME"),
    host: requireConfigValue("DB_HOST"),
    port: Number(getRuntimeEnvironmentValue("DB_PORT") || "5432"),
    user: requireConfigValue("DB_USER"),
    password: requireConfigValue("DB_PASSWORD"),
  });
  const reportPath = path.join(workspaceRoot, ".demo/catalog-seed-report.json");

  try {
    const report = await seedFoundationFoodsCatalog({
      databaseClient,
      archivePath: defaultFoundationFoodsArchivePath(),
      manifest: readFoundationFoodsManifest(defaultFoundationFoodsManifestPath()),
      reportPath,
    });
    console.log(
      formatFoundationFoodsSeedSummary(report, path.relative(workspaceRoot, reportPath) || reportPath),
    );
  } finally {
    await databaseClient.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
