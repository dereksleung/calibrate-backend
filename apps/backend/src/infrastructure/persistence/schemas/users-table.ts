import { UserTierEnumType } from "@domain/value-objects/user-tier.js";
import { ColumnType, Generated, Selectable, Insertable, Updateable } from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  email_verified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  webauthn_user_handle: string | null;
  tier: UserTierEnumType;
  created_at: ColumnType<Date, string, never>;
  updated_at: ColumnType<Date, string, Date>;
}

export type SelectableUser = Selectable<UsersTable>;
export type InsertableUser = Insertable<UsersTable>;
export type UpdateableUser = Updateable<UsersTable>;
