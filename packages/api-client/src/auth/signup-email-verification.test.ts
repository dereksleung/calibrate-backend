import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";

import {
  getRequestSignupEmailVerificationMutationOptions,
  requestSignupEmailVerification,
} from "./signup-email-verification.js";

describe("requestSignupEmailVerification", () => {
  it("posts the validated email and parses the challenge metadata", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const result = await requestSignupEmailVerification(transport, {
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

    expect(() => requestSignupEmailVerification(transport, { email: "not-an-email" })).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("getRequestSignupEmailVerificationMutationOptions", () => {
  it("uses the signup-verification key and requests an OTP when invoked", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const options = getRequestSignupEmailVerificationMutationOptions(transport);

    expect(options.mutationKey).toEqual(["requestSignupEmailVerification"]);
    await expect(options.mutationFn?.("person@example.com", {} as any)).resolves.toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
