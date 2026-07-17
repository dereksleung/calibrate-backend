import type { MobilePlatform, SessionTransport } from "@application";
import type { User } from "@domain";

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
  mobilePlatform: MobilePlatform | null;
  requestingIp: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface EmailOtpChallenge {
  id: string;
  email: string;
  purpose: "authentication";
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

export interface NewAuthenticatedSession {
  tokenDigest: string;
  transport: SessionTransport;
  mobilePlatform: MobilePlatform | null;
  createdAt: Date;
  lastSeenAt: Date;
  inactivityExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface ConsumeEmailOtpChallengeProps {
  challengeId: string;
  verifiedAt: Date;
  session: NewAuthenticatedSession;
}

export interface IEmailOtpChallengeRepository {
  create(challenge: NewEmailOtpChallenge): Promise<void>;
  invalidate(challengeId: string, invalidatedAt: Date): Promise<void>;
  findById(challengeId: string): Promise<EmailOtpChallenge | null>;
  recordFailedAttempt(challengeId: string, attemptedAt: Date): Promise<void>;
  consumeAndCreateSession(props: ConsumeEmailOtpChallengeProps): Promise<User | null>;
}
