import { defineConfig } from "kysely-ctl";
import path from "path";
import { createKyselyInstance } from "./src/infrastructure/persistence/database.js";

export default defineConfig({
  kysely: createKyselyInstance(),
  migrations: {
    migrationFolder: path.join(
      import.meta.dirname,
      "src",
      "infrastructure",
      "persistence",
      "migrations",
    ),
  },
});
