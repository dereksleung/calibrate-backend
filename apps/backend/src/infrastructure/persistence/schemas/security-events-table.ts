import type { ColumnType } from "kysely";

export interface SecurityEventsTable {
  id: string;
  user_id: string;
  event_type: string;
  created_at: ColumnType<Date, Date, never>;
}
