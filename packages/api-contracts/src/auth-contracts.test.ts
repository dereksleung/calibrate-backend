import { describe, expect, it } from "vitest";

import {
  AppPlatformHeaderValueSchema,
  AccessSessionRequiredErrorResponseSchema,
  AuthenticatedSessionResponseSchema,
  DeleteCurrentSessionResponseSchema,
  RefreshSessionRequiredErrorResponseSchema,
  RequestSignupEmailVerificationRequestBodySchema,
  RequestSignupEmailVerificationResponseSchema,
  VerifySignupEmailVerificationRequestBodySchema,
  VerifySignupEmailVerificationResponseSchema,
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
      RequestSignupEmailVerificationRequestBodySchema.parse({
        email: "  Person@Example.COM ",
      }),
    ).toEqual({
      email: "person@example.com",
    });
  });

  it("rejects invalid, oversized, and unexpected request fields", () => {
    expect(() =>
      RequestSignupEmailVerificationRequestBodySchema.parse({ email: "not-an-email" }),
    ).toThrow();
    expect(() =>
      RequestSignupEmailVerificationRequestBodySchema.parse({
        email: `${"a".repeat(310)}@example.com`,
      }),
    ).toThrow();
    expect(() =>
      RequestSignupEmailVerificationRequestBodySchema.parse({
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
    const result = RequestSignupEmailVerificationResponseSchema.parse({
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

describe("signup email verification contracts", () => {
  it("accepts a public challenge ID and exactly six ASCII digits", () => {
    expect(
      VerifySignupEmailVerificationRequestBodySchema.parse({
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
        VerifySignupEmailVerificationRequestBodySchema.parse({
          challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
          code,
        }),
      ).toThrow();
    },
  );

  it("returns workflow metadata without an enrollment credential", () => {
    const result = VerifySignupEmailVerificationResponseSchema.parse({
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });

    expect(result).toEqual({
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    expect(result).not.toHaveProperty("enrollmentToken");
    expect(result).not.toHaveProperty("tokenDigest");
    expect(result).not.toHaveProperty("webauthnUserHandle");
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
