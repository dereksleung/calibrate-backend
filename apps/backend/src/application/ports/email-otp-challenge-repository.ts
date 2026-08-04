import type { MobilePlatform, SessionTransport } from "@application/auth/session-client.js";

export type AccountEmailVerificationPurpose = "account-email-verification";
export type EmailOtpPurpose = "authentication" | AccountEmailVerificationPurpose;

export interface NewEmailOtpChallenge {
  id: string;
  email: string;
  purpose: AccountEmailVerificationPurpose;
  codeDigest: string;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
  attemptCount: number;
  maxAttempts: number;
  sessionTransport: SessionTransport;
  mobilePlatform: MobilePlatform | null;
  requestingIp: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface EmailOtpChallenge {
  id: string;
  email: string;
  purpose: EmailOtpPurpose;
  codeDigest: string;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
  attemptCount: number;
  maxAttempts: number;
  sessionTransport: SessionTransport;
  mobilePlatform: MobilePlatform | null;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}

export interface IEmailOtpChallengeRepository {
  create(challenge: NewEmailOtpChallenge): Promise<void>;
  invalidate(challengeId: string, invalidatedAt: Date): Promise<void>;
  findById(challengeId: string): Promise<EmailOtpChallenge | null>;
  recordFailedAttempt(challengeId: string, attemptedAt: Date): Promise<void>;
}
