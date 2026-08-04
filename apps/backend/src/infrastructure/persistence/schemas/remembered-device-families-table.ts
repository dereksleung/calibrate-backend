import type { ColumnType } from "kysely";

export interface RememberedDeviceFamiliesTable {
  id: string;
  user_id: string;
  created_at: ColumnType<Date, Date, never>;
  last_used_at: ColumnType<Date, Date, Date>;
  inactivity_expires_at: ColumnType<Date, Date, Date>;
  absolute_expires_at: ColumnType<Date, Date, never>;
  recent_passkey_authentication_at: ColumnType<Date | null, Date | null, Date | null>;
  recent_passkey_authentication_purpose: string | null;
  recent_passkey_authentication_credential_id: ColumnType<string | null, string | null | undefined, string | null>;
  recovery_id: ColumnType<string | null, string | null | undefined, string | null>;
  recovery_restriction_ends_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  authentication_method: string;
  current_refresh_generation: number;
  revoked_at: ColumnType<Date | null, Date | null, Date | null>;
  revocation_reason: string | null;
}
