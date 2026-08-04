import type { ColumnType } from "kysely";

export interface SecurityNotificationOutboxTable {
  id: string;
  security_event_id: string;
  user_id: string;
  event_type: string;
  payload: unknown;
  attempt_count: number;
  next_attempt_at: ColumnType<Date, Date, Date>;
  delivered_at: ColumnType<Date | null, Date | null, Date | null>;
  failed_at: ColumnType<Date | null, Date | null, Date | null>;
  created_at: ColumnType<Date, Date, never>;
}
