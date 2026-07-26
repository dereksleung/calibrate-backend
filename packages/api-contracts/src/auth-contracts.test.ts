import { describe, expect, it } from "vitest";

import {
  AppPlatformHeaderValueSchema,
  AuthenticatedSessionResponseSchema,
  RequestSignupEmailVerificationRequestBodySchema,
  RequestSignupEmailVerificationResponseSchema,
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
