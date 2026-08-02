import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors.js";
import type { ApiTransport } from "../transport.js";

import {
  getVerifyPasskeyAuthenticationMutationOptions,
  parsePasskeyAuthenticationError,
  requestPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} from "./passkey-authentication.js";

const authenticationOptions = {
  options: {
    challenge: "challenge-value",
    rpId: "localhost",
    timeout: 300_000 as const,
    userVerification: "required" as const,
  },
  expiresAt: "2030-01-01T00:05:00.000Z",
};

const authenticationCredential = {
  id: "Y3JlZGVudGlhbC1pZA",
  rawId: "Y3JlZGVudGlhbC1pZA",
  type: "public-key" as const,
  response: {
    authenticatorData: "authenticator-data",
    clientDataJSON: "client-data",
    signature: "c2lnbmF0dXJl",
    userHandle: "user-handle",
  },
  clientExtensionResults: {},
};

const authenticatedSession = {
  user: {
    id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
    email: "person@example.com",
    tier: "FREE",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  },
  sessionTransport: "cookie" as const,
};

describe("passkey authentication API client", () => {
  it("posts without a body to request usernameless authentication options", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse(authenticationOptions));
    const transport = { request } as unknown as ApiTransport;

    await expect(requestPasskeyAuthenticationOptions(transport)).resolves.toEqual(authenticationOptions);
    expect(request).toHaveBeenCalledWith({
      path: "/auth/passkeys/authentication/options",
      method: "POST",
      responseBodySchema: expect.any(Object),
    });
  });

  it("posts a strict assertion payload and returns only authenticated session data", async () => {
    const request = vi.fn(async ({ responseBodySchema, body }) => {
      expect(body).toEqual({ credential: authenticationCredential, rememberDevice: true });
      return responseBodySchema.parse(authenticatedSession);
    });
    const transport = { request } as unknown as ApiTransport;

    await expect(
      verifyPasskeyAuthentication(transport, { credential: authenticationCredential, rememberDevice: true }),
    ).resolves.toMatchObject({
      user: { email: "person@example.com", tier: "FREE" },
      sessionTransport: "cookie",
    });
  });

  it("does not retry assertion verification", () => {
    const options = getVerifyPasskeyAuthenticationMutationOptions({ request: vi.fn() });

    expect(options.mutationKey).toEqual(["verifyPasskeyAuthentication"]);
    expect(options.retry).toBe(false);
  });

  it("recognizes only stable passkey-authentication errors", () => {
    expect(
      parsePasskeyAuthenticationError(
        new ApiError({
          status: 429,
          statusText: "Too Many Requests",
          body: { error: "PASSKEY_AUTHENTICATION_RATE_LIMITED" },
          retryAfterSeconds: 60,
        }),
      ),
    ).toBe("PASSKEY_AUTHENTICATION_RATE_LIMITED");
    expect(parsePasskeyAuthenticationError(new Error("network"))).toBeNull();
  });
});
