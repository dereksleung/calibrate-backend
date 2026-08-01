import { describe, expect, it } from "vitest";

import {
  PasskeyRegistrationErrorResponseSchema,
  RegistrationResponseJSONSchema,
  VerifyPasskeyRegistrationRequestBodySchema,
} from "./index.js";

const validRegistrationResponse = {
  id: "credential-id",
  rawId: "credential-id",
  type: "public-key" as const,
  response: {
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
    attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
    transports: ["internal" as const],
  },
  clientExtensionResults: {},
};

describe("passkey registration request contracts", () => {
  it("accepts valid SimpleWebAuthn registration JSON without extra top-level fields", () => {
    expect(RegistrationResponseJSONSchema.parse(validRegistrationResponse)).toEqual(
      validRegistrationResponse,
    );
  });

  it("rejects invalid base64url, credential type, wrapper, and rememberDevice values", () => {
    expect(() =>
      RegistrationResponseJSONSchema.parse({
        ...validRegistrationResponse,
        id: "not valid base64url!!!",
      }),
    ).toThrow();

    expect(() =>
      RegistrationResponseJSONSchema.parse({
        ...validRegistrationResponse,
        type: "password",
      }),
    ).toThrow();

    expect(() =>
      VerifyPasskeyRegistrationRequestBodySchema.parse({
        credential: validRegistrationResponse,
        rememberDevice: "yes",
      }),
    ).toThrow();

    expect(() =>
      VerifyPasskeyRegistrationRequestBodySchema.parse({
        credential: validRegistrationResponse,
        rememberDevice: true,
        extra: true,
      }),
    ).toThrow();

    expect(() =>
      RegistrationResponseJSONSchema.parse({
        ...validRegistrationResponse,
        response: {
          ...validRegistrationResponse.response,
          transports: ["invalid-transport"],
        },
      }),
    ).toThrow();
  });

  it("keeps success and error schemas free of raw credential-token fields", () => {
    const error = PasskeyRegistrationErrorResponseSchema.parse({
      error: "PASSKEY_REGISTRATION_FAILED",
    });

    expect(error).toEqual({ error: "PASSKEY_REGISTRATION_FAILED" });
    expect(error).not.toHaveProperty("enrollmentToken");
    expect(error).not.toHaveProperty("accessToken");
    expect(error).not.toHaveProperty("refreshToken");
    expect(error).not.toHaveProperty("challenge");
  });
});
