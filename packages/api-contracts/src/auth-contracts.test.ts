import { describe, expect, it } from "vitest";

import {
  AppPlatformHeaderValueSchema,
  AccessSessionRequiredErrorResponseSchema,
  AccountAccessStatusResponseSchema,
  AccountRecoveryErrorResponseSchema,
  AuthenticatedSessionResponseSchema,
  AuthorizeRecoveryRegistrationRequestBodySchema,
  AuthorizeRecoveryRegistrationResponseSchema,
  DeleteCurrentSessionResponseSchema,
  RefreshSessionRequiredErrorResponseSchema,
  RequestAccountEmailVerificationRequestBodySchema,
  RequestAccountEmailVerificationResponseSchema,
  VerifyAccountEmailVerificationRequestBodySchema,
  VerifyAccountEmailVerificationResponseSchema,
} from "./index.js";

const user = {
  id: "9f26d52e-c3c7-4d30-96db-34749f0cf32a",
  email: "person@example.com",
  tier: "FREE",
  createdAt: "2026-07-12T12:00:00.000Z",
  updatedAt: "2026-07-12T12:00:00.000Z",
};

describe("signup email verification request contracts", () => {
  it("normalizes a valid recovery email without accepting credentials", () => {
    expect(
      RequestAccountEmailVerificationRequestBodySchema.parse({
        email: "  Person@Example.COM ",
      }),
    ).toEqual({
      email: "person@example.com",
    });
  });

  it("rejects invalid, oversized, and unexpected request fields", () => {
    expect(() =>
      RequestAccountEmailVerificationRequestBodySchema.parse({ email: "not-an-email" }),
    ).toThrow();
    expect(() =>
      RequestAccountEmailVerificationRequestBodySchema.parse({
        email: `${"a".repeat(310)}@example.com`,
      }),
    ).toThrow();
    expect(() =>
      RequestAccountEmailVerificationRequestBodySchema.parse({
        email: "person@example.com",
        password: "Password123!",
      }),
    ).toThrow();
  });

  it("accepts only the canonical native platform header values", () => {
    expect(AppPlatformHeaderValueSchema.parse("ios")).toBe("ios");
    expect(AppPlatformHeaderValueSchema.parse("android")).toBe("android");
    expect(() => AppPlatformHeaderValueSchema.parse("web")).toThrow();
    expect(() => AppPlatformHeaderValueSchema.parse("iOS")).toThrow();
  });

  it("returns public challenge timing metadata without the OTP", () => {
    const result = RequestAccountEmailVerificationResponseSchema.parse({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });

    expect(result).toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(result).not.toHaveProperty("code");
    expect(result).not.toHaveProperty("user");
    expect(result).not.toHaveProperty("sessionToken");
  });
});

describe("account email verification contracts", () => {
  it("accepts a public challenge ID and exactly six ASCII digits", () => {
    expect(
      VerifyAccountEmailVerificationRequestBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "012345",
      }),
    ).toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      code: "012345",
    });
  });

  it.each(["12345", "1234567", " 123456", "123456 ", "+12345", "12.345", "１２３４５６"]) (
    "rejects non-canonical verification code %s",
    (code) => {
      expect(() =>
        VerifyAccountEmailVerificationRequestBodySchema.parse({
          challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
          code,
        }),
      ).toThrow();
    },
  );

  it("accepts each exact post-verification continuation without credentials", () => {
    const passkeyRegistration = VerifyAccountEmailVerificationResponseSchema.parse({
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    const loginOrRecovery = VerifyAccountEmailVerificationResponseSchema.parse({
      next: "login-or-recovery",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });

    expect(passkeyRegistration).toEqual({
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    expect(loginOrRecovery).toEqual({ next: "login-or-recovery", expiresAt: "2030-01-01T00:05:00.000Z" });
    expect(passkeyRegistration).not.toHaveProperty("enrollmentToken");
    expect(loginOrRecovery).not.toHaveProperty("userId");
    expect(loginOrRecovery).not.toHaveProperty("credentialId");
  });

  it.each([
    { next: "passkey-registration" },
    { next: "login-or-recovery" },
    { next: "login-or-recovery", accountExists: true },
    { next: "login-or-recovery", userId: "9f26d52e-c3c7-4d30-96db-34749f0cf32a" },
  ])("rejects an incomplete or leaking continuation %#", (response) => {
    expect(() => VerifyAccountEmailVerificationResponseSchema.parse(response)).toThrow();
  });
});

describe("authenticated session response contract", () => {
  it("returns the current user and the credential transport without returning credentials", () => {
    const cookieSession = AuthenticatedSessionResponseSchema.parse({
      user,
      sessionTransport: "cookie",
    });
    const bearerSession = AuthenticatedSessionResponseSchema.parse({
      user,
      sessionTransport: "bearer",
    });

    expect(cookieSession.sessionTransport).toBe("cookie");
    expect(bearerSession.sessionTransport).toBe("bearer");
    expect(cookieSession).not.toHaveProperty("sessionToken");
    expect(bearerSession).not.toHaveProperty("sessionToken");
  });

  it("exposes only public recovery state and timestamps when session security metadata is present", () => {
    const session = AuthenticatedSessionResponseSchema.parse({
      user,
      sessionTransport: "cookie",
      security: {
        activeRecovery: {
          state: "provisional",
          restrictionEndsAt: "2030-01-06T00:00:00.000Z",
        },
        sessionRestriction: {
          state: "restricted",
          restrictionEndsAt: "2030-01-06T00:00:00.000Z",
        },
      },
    });

    expect(session.security).toEqual({
      activeRecovery: { state: "provisional", restrictionEndsAt: "2030-01-06T00:00:00.000Z" },
      sessionRestriction: { state: "restricted", restrictionEndsAt: "2030-01-06T00:00:00.000Z" },
    });
    expect(() =>
      AuthenticatedSessionResponseSchema.parse({
        ...session,
        security: { ...session.security, recoveryId: "secret" },
      }),
    ).toThrow();
  });
});

describe("account access and recovery contracts", () => {
  it("accepts only public account-access status", () => {
    expect(
      AccountAccessStatusResponseSchema.parse({
        email: "person@example.com",
        hasRegisteredPasskeys: true,
        activeRecovery: { state: "promotion-eligible", restrictionEndsAt: "2030-01-06T00:00:00.000Z" },
        authorizationExpiresAt: "2030-01-01T00:15:00.000Z",
      }),
    ).toEqual({
      email: "person@example.com",
      hasRegisteredPasskeys: true,
      activeRecovery: { state: "promotion-eligible", restrictionEndsAt: "2030-01-06T00:00:00.000Z" },
      authorizationExpiresAt: "2030-01-01T00:15:00.000Z",
    });
    expect(() =>
      AccountAccessStatusResponseSchema.parse({
        email: "person@example.com",
        hasRegisteredPasskeys: true,
        activeRecovery: { state: "none", restrictionEndsAt: "2030-01-06T00:00:00.000Z" },
        authorizationExpiresAt: "2030-01-01T00:15:00.000Z",
      }),
    ).toThrow();
  });

  it("permits only explicit recovery registration modes and public expiry metadata", () => {
    expect(AuthorizeRecoveryRegistrationRequestBodySchema.parse({ mode: "create" })).toEqual({
      mode: "create",
    });
    expect(AuthorizeRecoveryRegistrationResponseSchema.parse({
      next: "recovery-passkey-registration",
      expiresAt: "2030-01-01T00:15:00.000Z",
    })).toEqual({ next: "recovery-passkey-registration", expiresAt: "2030-01-01T00:15:00.000Z" });
    expect(() => AuthorizeRecoveryRegistrationRequestBodySchema.parse({ mode: "automatic" })).toThrow();
    expect(() =>
      AuthorizeRecoveryRegistrationResponseSchema.parse({
        next: "recovery-passkey-registration",
        expiresAt: "2030-01-01T00:15:00.000Z",
        authorization: "secret",
      }),
    ).toThrow();
  });

  it("round-trips every stable recovery error without response metadata", () => {
    for (const error of [
      "ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED",
      "RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED",
      "IDENTIFIED_PASSKEY_AUTHENTICATION_FAILED",
      "RECOVERY_PASSKEY_REGISTRATION_FAILED",
      "RECOVERY_PROMOTION_FAILED",
      "RECOVERY_CANCELLATION_FAILED",
      "RECOVERY_SECURITY_RESTRICTION_ACTIVE",
      "NO_REGISTERED_PASSKEYS",
      "ACCOUNT_ACCESS_STATE_CONFLICT",
      "RECOVERY_ALREADY_ACTIVE",
      "RECOVERY_PROMOTION_NOT_READY",
      "RECOVERY_STATE_CONFLICT",
      "ACCOUNT_RECOVERY_RATE_LIMITED",
      "ACCOUNT_RECOVERY_UNAVAILABLE",
    ]) {
      expect(AccountRecoveryErrorResponseSchema.parse({ error })).toEqual({ error });
    }

    expect(() =>
      AccountRecoveryErrorResponseSchema.parse({
        error: "RECOVERY_SECURITY_RESTRICTION_ACTIVE",
        restrictionEndsAt: "2030-01-06T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("session restoration errors", () => {
  it("exposes only stable unauthenticated states", () => {
    expect(AccessSessionRequiredErrorResponseSchema.parse({ error: "ACCESS_SESSION_REQUIRED" })).toEqual({
      error: "ACCESS_SESSION_REQUIRED",
    });
    expect(RefreshSessionRequiredErrorResponseSchema.parse({ error: "REFRESH_SESSION_REQUIRED" })).toEqual({
      error: "REFRESH_SESSION_REQUIRED",
    });
    expect(() => AccessSessionRequiredErrorResponseSchema.parse({ error: "expired" })).toThrow();
    expect(() => RefreshSessionRequiredErrorResponseSchema.parse({ error: "REFRESH_SESSION_REQUIRED", token: "x" })).toThrow();
  });
});

describe("current-session logout response contract", () => {
  it("accepts only the empty successful response and rejects credential-shaped data", () => {
    expect(DeleteCurrentSessionResponseSchema.parse(null)).toBeNull();
    expect(() =>
      DeleteCurrentSessionResponseSchema.parse({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        familyId: "family-id",
      }),
    ).toThrow();
  });
});
