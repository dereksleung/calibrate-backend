import type { User } from "@domain/entities/user.js";

export const SIGNUP_PASSKEY_REGISTRATION_PURPOSE = "signup-passkey-registration" as const;

export interface PrepareSignupPasskeyRegistrationInput {
  enrollmentTokenDigest: string;
  candidateUserHandle: string;
  rawChallenge: string;
  challengeDigest: string;
  now: Date;
  maxOptionsRequests: number;
  maxVerificationAttempts: number;
}

export interface PreparedSignupPasskeyRegistration {
  enrollmentAuthorizationId: string;
  challengeId: string;
  email: string;
  userHandle: string;
  rawChallenge: string;
  challengeExpiresAt: Date;
}

export interface ActiveSignupRegistrationChallenge {
  challengeId: string;
  enrollmentAuthorizationId: string;
  email: string;
  userHandle: string;
  challengeExpiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
}

export interface VerifiedPasskeyCredentialInput {
  credentialId: string;
  publicKey: Uint8Array;
  algorithm: number;
  transports: string[];
  signatureCounter: number;
  aaguid: string;
  backupEligible: boolean;
  backupState: boolean;
}

export interface CompleteSignupPasskeyRegistrationInput {
  enrollmentTokenDigest: string;
  challengeDigest: string;
  now: Date;
  user: User;
  passkey: VerifiedPasskeyCredentialInput;
  accessTokenDigest: string;
  refreshTokenDigest: string;
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
  securityEventId: string;
}

export interface CompleteSignupPasskeyRegistrationResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  accessInactivityExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface ISignupPasskeyRegistrationRepository {
  prepareRegistration(
    input: PrepareSignupPasskeyRegistrationInput,
  ): Promise<PreparedSignupPasskeyRegistration>;

  findActiveChallenge(input: {
    enrollmentTokenDigest: string;
    challengeDigest: string;
    now: Date;
  }): Promise<ActiveSignupRegistrationChallenge | null>;

  recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void>;

  completeRegistration(
    input: CompleteSignupPasskeyRegistrationInput,
    accessToken: string,
    refreshToken: string,
  ): Promise<CompleteSignupPasskeyRegistrationResult>;
}
