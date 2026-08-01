import type { ColumnType } from "kysely";

export interface RefreshTokenGenerationsTable {
  id: string;
  family_id: string;
  generation: number;
  token_digest: string;
  parent_generation_id: string | null;
  replacement_generation_id: string | null;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  revoked_at: ColumnType<Date | null, Date | null, Date | null>;
}
