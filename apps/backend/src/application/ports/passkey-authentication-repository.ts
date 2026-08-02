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

export interface IPasskeyAuthenticationRepository {
  prepareAuthentication(input: PreparePasskeyAuthenticationInput): Promise<PreparedPasskeyAuthentication>;

  consumeVerificationRateLimit(input: ConsumePasskeyAuthenticationVerificationRateLimitInput): Promise<void>;
}
