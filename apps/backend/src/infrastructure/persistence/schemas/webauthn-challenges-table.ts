import type { ColumnType } from "kysely";

export interface WebauthnChallengesTable {
  id: string;
  enrollment_authorization_id: string | null;
  purpose: string;
  challenge_digest: string;
  attempt_count: number;
  max_attempts: number;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
}
