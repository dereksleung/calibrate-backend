import type { AppPlatformHeaderValue, SessionTransport } from "@calibrate/api-contracts";

export interface NewEmailOtpChallenge {
  id: string;
  email: string;
  purpose: "authentication";
  codeDigest: string;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
  attemptCount: number;
  maxAttempts: number;
  sessionTransport: SessionTransport;
  mobilePlatform: AppPlatformHeaderValue | null;
  requestingIp: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface IEmailOtpChallengeRepository {
  create(challenge: NewEmailOtpChallenge): Promise<void>;
  invalidate(challengeId: string, invalidatedAt: Date): Promise<void>;
}
