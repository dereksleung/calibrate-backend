import type { MobilePlatform, SessionTransport } from "@application/auth/session-client.js";

export interface NewSignupEnrollmentAuthorization {
  id: string;
  email: string;
  tokenDigest: string;
  sessionTransport: SessionTransport;
  mobilePlatform: MobilePlatform | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface ConsumeAndCreateEnrollmentAuthorizationProps {
  challengeId: string;
  consumedAt: Date;
  authorization: NewSignupEnrollmentAuthorization;
}

export interface CreateLocalDevelopmentEnrollmentAuthorizationProps {
  authorization: NewSignupEnrollmentAuthorization;
}

export type EmailVerificationContinuation =
  | { next: "login-or-recovery" }
  | { next: "passkey-registration" };

/** Owns the transaction that atomically consumes a verified OTP and resolves its continuation. */
export interface ISignupEnrollmentAuthorizationRepository {
  createLocalDevelopmentAuthorization(
    props: CreateLocalDevelopmentEnrollmentAuthorizationProps,
  ): Promise<void>;

  consumeAndResolveContinuation(
    props: ConsumeAndCreateEnrollmentAuthorizationProps,
  ): Promise<EmailVerificationContinuation | null>;
}
