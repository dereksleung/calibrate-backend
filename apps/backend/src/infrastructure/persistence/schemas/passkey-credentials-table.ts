import type { ColumnType } from "kysely";

export interface PasskeyCredentialsTable {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  algorithm: number;
  transports: string[];
  signature_counter: bigint;
  aaguid: string;
  backup_eligible: boolean;
  backup_state: boolean;
  created_at: ColumnType<Date, Date, never>;
  last_used_at: ColumnType<Date | null, Date | null, Date | null>;
  revoked_at: ColumnType<Date | null, Date | null, Date | null>;
}
