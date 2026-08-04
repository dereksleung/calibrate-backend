import type { ColumnType } from "kysely";

export interface RecoveryRegistrationAuthorizationsTable {
  id: string;
  user_id: string;
  account_access_authorization_id: string;
  replaces_recovery_id: string | null;
  token_digest: string;
  client_binding: string;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
}
