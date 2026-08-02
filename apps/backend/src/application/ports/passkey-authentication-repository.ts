export const PASSKEY_LOGIN_PURPOSE = "passkey-login" as const;
export const PASSKEY_AUTHENTICATION_OPTIONS_RATE_LIMIT_SCOPE = "passkey-authentication-options" as const;
export const PASSKEY_AUTHENTICATION_VERIFICATION_RATE_LIMIT_SCOPE =
  "passkey-authentication-verification" as const;

export interface PreparePasskeyAuthenticationInput {
  rawChallenge: string;
  challengeDigest: string;
  requestingIp: string;
  now: Date;
  maxOptionsRequestsPerIp: number;
  globalHourlyLimit: number;
  maxVerificationAttempts: number;
}

export interface PreparedPasskeyAuthentication {
  challengeId: string;
  rawChallenge: string;
  challengeExpiresAt: Date;
}

export interface ConsumePasskeyAuthenticationVerificationRateLimitInput {
  requestingIp: string;
  now: Date;
  maxVerificationRequestsPerIp: number;
  globalHourlyLimit: number;
}

export interface ActivePasskeyAuthenticationCredential {
  challengeId: string;
  userHandle: string;
  credentialId: string;
  publicKey: Uint8Array;
  signatureCounter: number;
  transports: string[];
  backupEligible: boolean;
  backupState: boolean;
}

export interface CompletePasskeyAuthenticationInput {
  challengeDigest: string;
  credentialId: string;
  now: Date;
  newCounter: number;
  backupState: boolean;
  accessTokenDigest: string;
  refreshTokenDigest: string;
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface IPasskeyAuthenticationRepository {
  prepareAuthentication(input: PreparePasskeyAuthenticationInput): Promise<PreparedPasskeyAuthentication>;

  consumeVerificationRateLimit(input: ConsumePasskeyAuthenticationVerificationRateLimitInput): Promise<void>;

  findActiveCredential(input: {
    credentialId: string;
    challengeDigest: string;
    now: Date;
  }): Promise<ActivePasskeyAuthenticationCredential | null>;

  recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void>;

  completeAuthentication(input: CompletePasskeyAuthenticationInput): Promise<{ userId: string }>;
}
