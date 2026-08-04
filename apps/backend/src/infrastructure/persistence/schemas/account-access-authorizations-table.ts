import type { ColumnType } from "kysely";

export interface AccountAccessAuthorizationsTable {
  id: string;
  user_id: string;
  source_otp_challenge_id: string;
  token_digest: string;
  client_binding: string;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
}
