import type { MobilePlatform, SessionTransport } from "@application";

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

/** Owns the transaction that gives a verified OTP exactly one enrollment authorization. */
export interface ISignupEnrollmentAuthorizationRepository {
  consumeAndCreate(
    props: ConsumeAndCreateEnrollmentAuthorizationProps,
  ): Promise<boolean>;
}
