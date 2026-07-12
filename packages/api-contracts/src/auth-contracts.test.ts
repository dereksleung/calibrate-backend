import { describe, expect, it } from "vitest";

import {
  AppPlatformHeaderValueSchema,
  AuthenticatedSessionResponseSchema,
  RequestEmailOtpRequestBodySchema,
  RequestEmailOtpResponseSchema,
  VerifyEmailOtpRequestBodySchema,
  VerifyEmailOtpResponseSchema,
} from "./index.js";

const user = {
  id: "9f26d52e-c3c7-4d30-96db-34749f0cf32a",
  email: "person@example.com",
  tier: "FREE",
  createdAt: "2026-07-12T12:00:00.000Z",
  updatedAt: "2026-07-12T12:00:00.000Z",
};

describe("email OTP request contracts", () => {
  it("accepts a valid email without password credentials", () => {
    expect(RequestEmailOtpRequestBodySchema.parse({ email: "person@example.com" })).toEqual({
      email: "person@example.com",
    });
  });

  it("rejects invalid emails and unexpected request fields", () => {
    expect(() => RequestEmailOtpRequestBodySchema.parse({ email: "not-an-email" })).toThrow();
    expect(() =>
      RequestEmailOtpRequestBodySchema.parse({
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
    const result = RequestEmailOtpResponseSchema.parse({
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
  });
});

describe("email OTP verification contracts", () => {
  it("requires a UUID challenge identifier and exactly six numeric digits", () => {
    expect(
      VerifyEmailOtpRequestBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "004219",
      }),
    ).toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      code: "004219",
    });

    expect(() =>
      VerifyEmailOtpRequestBodySchema.parse({ challengeId: "challenge-1", code: "004219" }),
    ).toThrow();
    expect(() =>
      VerifyEmailOtpRequestBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "4219",
      }),
    ).toThrow();
    expect(() =>
      VerifyEmailOtpRequestBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "abcdef",
      }),
    ).toThrow();
  });

  it("returns a cookie-backed authenticated session without exposing a token", () => {
    const result = VerifyEmailOtpResponseSchema.parse({
      user,
      sessionTransport: "cookie",
    });

    expect(result.sessionTransport).toBe("cookie");
    expect(result).not.toHaveProperty("sessionToken");
  });

  it("returns an opaque bearer session only for mobile verification", () => {
    const result = VerifyEmailOtpResponseSchema.parse({
      user,
      sessionTransport: "bearer",
      sessionToken: "7WsxZrb5gk6O9HrprY2kh5vRl7V0SJUn9YhlAOzTo7A",
      expiresAt: "2026-08-11T12:00:00.000Z",
    });

    expect(result.sessionTransport).toBe("bearer");
    expect(result).toHaveProperty("sessionToken");
    if (result.sessionTransport !== "bearer") {
      throw new Error("Expected bearer session");
    }
    expect(result.expiresAt).toEqual("2026-08-11T12:00:00.000Z");
  });

  it("rejects a session token on the cookie response variant", () => {
    expect(() =>
      VerifyEmailOtpResponseSchema.parse({
        user,
        sessionTransport: "cookie",
        sessionToken: "7WsxZrb5gk6O9HrprY2kh5vRl7V0SJUn9YhlAOzTo7A",
        expiresAt: "2026-08-11T12:00:00.000Z",
      }),
    ).toThrow();
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
