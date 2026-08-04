import type { MobilePlatform, SessionTransport } from "@application/auth/session-client.js";
import type { ColumnType, Generated } from "kysely";

export interface EmailOtpChallengesTable {
  id: string;
  email: string;
  purpose: "authentication" | "account-email-verification";
  code_digest: string;
  hmac_format_version: number;
  hmac_key_version: number;
  attempt_count: Generated<number>;
  max_attempts: number;
  session_transport: SessionTransport;
  mobile_platform: MobilePlatform | null;
  requesting_ip_digest: string | null;
  expires_at: ColumnType<Date, Date, never>;
  consumed_at: ColumnType<Date | null, Date | null, Date | null>;
  invalidated_at: ColumnType<Date | null, Date | null, Date | null>;
  created_at: ColumnType<Date, Date, never>;
}
