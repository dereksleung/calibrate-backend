import {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
} from "kysely";

export interface DayLogsTable {
  id: Generated<string>;
  date: ColumnType<Date, string, never>;
  user_id: ColumnType<string, string, never>;
  weight: ColumnType<number | null, number | null, number | null>;
  created_at: ColumnType<Date, string, never>;
  updated_at: ColumnType<Date, string, Date>;
}

export type SelectableDayLog = Selectable<DayLogsTable>;
export type InsertableDayLog = Insertable<DayLogsTable>;
export type UpdateableDayLog = Updateable<DayLogsTable>;
