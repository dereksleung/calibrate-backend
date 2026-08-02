import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../errors.js";
import type { ApiTransport } from "../transport.js";

import {
  getRequestPasskeyRegistrationOptionsMutationOptions,
  getVerifyPasskeyRegistrationMutationOptions,
  parsePasskeyRegistrationError,
  requestPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "./signup-passkey-registration.js";

const registrationOptions = {
  challenge: "challenge-value",
  rp: { name: "Calibrate", id: "localhost" },
  user: { id: "user-handle", name: "person@example.com", displayName: "person@example.com" },
  pubKeyCredParams: [{ alg: -7, type: "public-key" }],
};

const registrationCredential = {
  id: "Y3JlZGVudGlhbC1pZA",
  rawId: "Y3JlZGVudGlhbC1pZA",
  type: "public-key" as const,
  response: {
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
    attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
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

describe("requestPasskeyRegistrationOptions", () => {
  it("posts to the options endpoint with credentialed transport", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse(registrationOptions),
    );
    const transport = { request } as unknown as ApiTransport;

    const result = await requestPasskeyRegistrationOptions(transport);

    expect(request).toHaveBeenCalledWith({
      path: "/auth/passkeys/registration/options",
      method: "POST",
      responseBodySchema: expect.any(Object),
    });
    expect(result.challenge).toBe("challenge-value");
  });
});

describe("verifyPasskeyRegistration", () => {
  it("posts the validated credential payload and parses the authenticated session", async () => {
    const request = vi.fn(async ({ responseBodySchema, body }) => {
      expect(body).toEqual({ credential: registrationCredential, rememberDevice: true });
      return responseBodySchema.parse(authenticatedSession);
    });
    const transport = { request } as unknown as ApiTransport;

    await expect(
      verifyPasskeyRegistration(transport, {
        credential: registrationCredential,
        rememberDevice: true,
      }),
    ).resolves.toMatchObject({
      user: { email: "person@example.com", tier: "FREE" },
      sessionTransport: "cookie",
    });
    expect(request).toHaveBeenCalledWith({
      path: "/auth/passkeys/registration/verify",
      method: "POST",
      body: { credential: registrationCredential, rememberDevice: true },
      responseBodySchema: expect.any(Object),
    });
  });
});

describe("getVerifyPasskeyRegistrationMutationOptions", () => {
  it("locks retry to false so verification cannot be silently replayed", () => {
    const transport = { request: vi.fn() } as unknown as ApiTransport;
    const options = getVerifyPasskeyRegistrationMutationOptions(transport);

    expect(options.mutationKey).toEqual(["verifyPasskeyRegistration"]);
    expect(options.retry).toBe(false);
  });

  it("does not override an explicit retry option from the caller", () => {
    const transport = { request: vi.fn() } as unknown as ApiTransport;
    const options = getVerifyPasskeyRegistrationMutationOptions(transport, { retry: 3 });

    expect(options.retry).toBe(3);
  });
});

describe("parsePasskeyRegistrationError", () => {
  it("returns stable passkey registration error codes from API failures", () => {
    const error = new ApiError({
      status: 400,
      statusText: "Bad Request",
      body: { error: "PASSKEY_REGISTRATION_FAILED" },
    });

    expect(parsePasskeyRegistrationError(error)).toBe("PASSKEY_REGISTRATION_FAILED");
    expect(parsePasskeyRegistrationError(new Error("network"))).toBeNull();
  });
});

describe("getRequestPasskeyRegistrationOptionsMutationOptions", () => {
  it("requests fresh options when invoked", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse(registrationOptions),
    );
    const transport = { request } as unknown as ApiTransport;
    const options = getRequestPasskeyRegistrationOptionsMutationOptions(transport);

    await expect(options.mutationFn?.(undefined, {} as never)).resolves.toEqual(registrationOptions);
    expect(request).toHaveBeenCalledOnce();
  });
});
