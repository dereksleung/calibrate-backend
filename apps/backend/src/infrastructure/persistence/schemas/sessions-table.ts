import type { AppPlatformHeaderValue, SessionTransport } from "@calibrate/api-contracts";
import type { ColumnType } from "kysely";

export interface SessionsTable {
  id: string;
  user_id: string;
  token_digest: string;
  transport: SessionTransport;
  mobile_platform: AppPlatformHeaderValue | null;
  created_at: ColumnType<Date, Date, never>;
  last_seen_at: ColumnType<Date, Date, Date>;
  inactivity_expires_at: ColumnType<Date, Date, Date>;
  absolute_expires_at: ColumnType<Date, Date, never>;
  revoked_at: ColumnType<Date | null, Date | null, Date | null>;
  renewed_at: ColumnType<Date | null, Date | null, Date | null>;
}
