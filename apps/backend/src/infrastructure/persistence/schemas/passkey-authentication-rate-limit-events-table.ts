import type { ColumnType } from "kysely";

export interface PasskeyAuthenticationRateLimitEventsTable {
  id: string;
  scope: string;
  requesting_ip_digest: string;
  created_at: ColumnType<Date, Date, never>;
}
