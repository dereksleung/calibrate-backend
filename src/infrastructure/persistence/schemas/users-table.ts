import {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
} from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  tier: string;
  created_at: ColumnType<Date, string, never>;
  updated_at: ColumnType<Date, string, Date>;
}

export type SelectableUser = Selectable<UsersTable>;
export type InsertableUser = Insertable<UsersTable>;
export type UpdateableUser = Updateable<UsersTable>;
