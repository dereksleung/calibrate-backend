import { describe, expect, it } from "vitest";

import {
  AuthenticatedSessionResponseSchema,
  AuthenticationResponseJSONSchema,
  IdentifiedPasskeyAuthenticationOptionsResponseSchema,
  PasskeyAuthenticationErrorResponseSchema,
  PasskeyAuthenticationOptionsResponseSchema,
  VerifyPasskeyAuthenticationRequestBodySchema,
} from "./index.js";

const validAuthenticationResponse = {
  id: "Y3JlZGVudGlhbC1pZA",
  rawId: "Y3JlZGVudGlhbC1pZA",
  type: "public-key" as const,
  response: {
    authenticatorData: "YXV0aGVudGljYXRvci1kYXRh",
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
    signature: "c2lnbmF0dXJl",
    userHandle: "dXNlci1oYW5kbGU",
  },
  clientExtensionResults: {},
};

describe("passkey authentication contracts", () => {
  it("accepts a complete assertion and permits an omitted user handle", () => {
    expect(AuthenticationResponseJSONSchema.parse(validAuthenticationResponse)).toEqual(
      validAuthenticationResponse,
    );

    const { userHandle: _userHandle, ...responseWithoutUserHandle } = validAuthenticationResponse.response;
    expect(
      AuthenticationResponseJSONSchema.parse({
        ...validAuthenticationResponse,
        response: responseWithoutUserHandle,
      }),
    ).toEqual({ ...validAuthenticationResponse, response: responseWithoutUserHandle });
  });

  it("rejects malformed assertions and unexpected fields", () => {
    for (const credential of [
      { ...validAuthenticationResponse, id: undefined },
      { ...validAuthenticationResponse, type: "password" },
      { ...validAuthenticationResponse, rawId: "not base64url!!!" },
      {
        ...validAuthenticationResponse,
        response: { ...validAuthenticationResponse.response, signature: undefined },
      },
      { ...validAuthenticationResponse, extra: true },
    ]) {
      expect(() => AuthenticationResponseJSONSchema.parse(credential)).toThrow();
    }
  });

  it("requires a boolean remember-device value", () => {
    expect(
      VerifyPasskeyAuthenticationRequestBodySchema.parse({
        credential: validAuthenticationResponse,
        rememberDevice: true,
      }),
    ).toEqual({ credential: validAuthenticationResponse, rememberDevice: true });

    expect(() =>
      VerifyPasskeyAuthenticationRequestBodySchema.parse({ credential: validAuthenticationResponse }),
    ).toThrow();
  });

  it("accepts only the usernameless authentication-options response", () => {
    const response = {
      options: {
        challenge: "challenge",
        rpId: "localhost",
        timeout: 300_000,
        userVerification: "required" as const,
      },
      expiresAt: "2026-08-01T00:05:00.000Z",
    };

    expect(PasskeyAuthenticationOptionsResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      PasskeyAuthenticationOptionsResponseSchema.parse({
        ...response,
        options: { ...response.options, allowCredentials: [] },
      }),
    ).toThrow();
    expect(() =>
      PasskeyAuthenticationOptionsResponseSchema.parse({ ...response, expiresAt: "not-a-date" }),
    ).toThrow();
  });

  it("requires a non-empty allow-credentials list for identified options", () => {
    const response = {
      options: {
        challenge: "challenge",
        rpId: "localhost",
        timeout: 300_000 as const,
        userVerification: "required" as const,
        allowCredentials: [{ id: "Y3JlZGVudGlhbC1pZA", type: "public-key" as const, transports: ["internal" as const] }],
      },
      expiresAt: "2026-08-01T00:05:00.000Z",
    };

    expect(IdentifiedPasskeyAuthenticationOptionsResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      IdentifiedPasskeyAuthenticationOptionsResponseSchema.parse({
        ...response,
        options: { ...response.options, allowCredentials: [] },
      }),
    ).toThrow();
  });

  it("round-trips every stable authentication error and rejects token-shaped session fields", () => {
    for (const error of [
      "PASSKEY_AUTHENTICATION_FAILED",
      "ORIGIN_NOT_ALLOWED",
      "PASSKEY_AUTHENTICATION_STATE_CONFLICT",
      "PASSKEY_AUTHENTICATION_RATE_LIMITED",
      "PASSKEY_AUTHENTICATION_UNAVAILABLE",
    ]) {
      expect(PasskeyAuthenticationErrorResponseSchema.parse({ error })).toEqual({ error });
    }

    expect(() =>
      AuthenticatedSessionResponseSchema.parse({
        user: {
          id: "01800000-0000-7000-8000-000000000000",
          email: "person@example.com",
          tier: "FREE",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        sessionTransport: "cookie",
        accessToken: "secret",
      }),
    ).toThrow();
  });
});
