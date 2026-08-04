import type { ColumnType } from "kysely";

export interface AccountRecoveriesTable {
  id: string;
  user_id: string;
  provisional_passkey_id: string | null;
  registered_at: ColumnType<Date, Date, never>;
  restriction_ends_at: ColumnType<Date, Date, never>;
  promoted_at: ColumnType<Date | null, Date | null, Date | null>;
  cancelled_at: ColumnType<Date | null, Date | null, Date | null>;
  replaced_at: ColumnType<Date | null, Date | null, Date | null>;
  terminal_reason: string | null;
}
