import type { ColumnType } from "kysely";

export interface WebauthnChallengesTable {
  id: string;
  enrollment_authorization_id: string | null;
  account_access_authorization_id: ColumnType<string | null, string | null | undefined, string | null>;
  recovery_registration_authorization_id: ColumnType<string | null, string | null | undefined, string | null>;
  recovery_id: ColumnType<string | null, string | null | undefined, string | null>;
  purpose: string;
  challenge_digest: string;
  attempt_count: number;
  max_attempts: number;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
}
