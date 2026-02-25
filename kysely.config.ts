import { defineConfig } from "kysely-ctl";
import path from "path";
import { createKyselyInstance } from "./src/data/index.js";

export default defineConfig({
  kysely: createKyselyInstance(),
  migrations: {
    migrationFolder: path.join(import.meta.dirname, "src", "migrations"),
  },
});
