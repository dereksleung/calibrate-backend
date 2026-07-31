import type { MobilePlatform, SessionTransport } from "@application";
import type { ColumnType } from "kysely";

export interface SignupEnrollmentAuthorizationsTable {
  id: string;
  email: string;
  token_digest: string;
  session_transport: SessionTransport;
  mobile_platform: MobilePlatform | null;
  webauthn_user_handle: string | null;
  created_at: ColumnType<Date, Date, never>;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
}
