import { defineConfig } from "kysely-ctl";
import path from "path";

import { databaseClient } from "./src/infrastructure/persistence/database.js";

export default defineConfig({
  kysely: databaseClient,
  migrations: {
    migrationFolder: path.join(import.meta.dirname, "src", "infrastructure", "persistence", "migrations"),
  },
});
