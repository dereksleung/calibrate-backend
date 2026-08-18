import { isLinkedWorktreeDatabaseName } from "./worktree-database-name.js";

const SYSTEM_DATABASES = new Set(["postgres", "template0", "template1"]);

export function isTeardownDatabaseAllowed(databaseName: string, primaryDbName: string): boolean {
  if (!isLinkedWorktreeDatabaseName(databaseName)) return false;
  if (SYSTEM_DATABASES.has(databaseName)) return false;
  if (databaseName === primaryDbName) return false;
  return true;
}

export function explainTeardownRefusal(databaseName: string, primaryDbName: string): string {
  if (databaseName === primaryDbName) {
    return `Refusing to drop the primary checkout database "${databaseName}".`;
  }
  if (SYSTEM_DATABASES.has(databaseName)) {
    return `Refusing to drop system database "${databaseName}".`;
  }
  if (!isLinkedWorktreeDatabaseName(databaseName)) {
    return `Refusing to drop "${databaseName}". Only calibrate_wt_* databases created by worktree-setup may be dropped.`;
  }
  return `Refusing to drop "${databaseName}".`;
}
