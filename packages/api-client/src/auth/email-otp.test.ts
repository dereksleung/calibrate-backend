import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";
import {
  getRequestEmailOtpMutationOptions,
  requestEmailOtp,
} from "./email-otp.js";

describe("requestEmailOtp", () => {
  it("posts the validated email and parses the challenge metadata", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const result = await requestEmailOtp(transport, {
      email: "person@example.com",
    });

    expect(request).toHaveBeenCalledWith({
      path: "/auth/email-otp",
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

    expect(() =>
      requestEmailOtp(transport, { email: "not-an-email" }),
    ).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe("getRequestEmailOtpMutationOptions", () => {
  it("uses an email-scoped key and requests an OTP when invoked", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    const options = getRequestEmailOtpMutationOptions(
      transport,
      "person@example.com",
    );

    expect(options.mutationKey).toEqual([
      "requestEmailOtp",
      "person@example.com",
    ]);
    await expect(options.mutationFn?.({} as never)).resolves.toEqual({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
