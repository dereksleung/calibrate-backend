import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";

import {
  getRequestAccountEmailVerificationMutationOptions,
  requestAccountEmailVerification,
  verifyAccountEmailVerification,
} from "./account-email-verification.js";

describe("requestAccountEmailVerification", () => {
  it("posts the validated email and parses the challenge metadata", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const result = await requestAccountEmailVerification(transport, {
      email: "  Person@Example.COM ",
    });

    expect(request).toHaveBeenCalledWith({
      path: "/auth/email-verification",
      method: "POST",
      body: { email: "person@example.com" },
      responseBodySchema: expect.any(Object),
    });
    expect(result).toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it("rejects invalid input before making a request", () => {
    const request = vi.fn();
    const transport = { request } as unknown as ApiTransport;

    expect(() => requestAccountEmailVerification(transport, { email: "not-an-email" })).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("verifyAccountEmailVerification", () => {
  it.each([
    { next: "passkey-registration", expiresAt: "2030-01-01T00:05:00.000Z" },
    { next: "login-or-recovery" },
  ])("posts a code and parses continuation %#", async (expected) => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse(expected),
    );
    const transport = { request } as unknown as ApiTransport;

    await expect(
      verifyAccountEmailVerification(transport, {
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "012345",
      }),
    ).resolves.toEqual(expected);
    expect(request).toHaveBeenCalledWith({
      path: "/auth/email-verification/verify",
      method: "POST",
      body: {
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        code: "012345",
      },
      responseBodySchema: expect.any(Object),
    });
  });
});

describe("getRequestAccountEmailVerificationMutationOptions", () => {
  it("uses the neutral verification key and requests an OTP when invoked", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const options = getRequestAccountEmailVerificationMutationOptions(transport);

    expect(options.mutationKey).toEqual(["requestAccountEmailVerification"]);
    await expect(options.mutationFn?.("person@example.com", {} as any)).resolves.toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
