import "dotenv/config";
import { FileMigrationProvider, Migrator } from "kysely";
import { createKyselyInstance } from "@data";
import { promises as fs } from "fs";
import * as path from "path";

async function migrateToLatest() {
  const db = createKyselyInstance();
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: import.meta.dirname,
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();
