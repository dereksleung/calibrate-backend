import type { WebAuthnRegistrationAttestation } from "@application/ports/webauthn-registration-port.js";

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SimpleWebAuthnRegistrationAdapter } from "../simple-webauthn-registration-adapter.js";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
}));

vi.mock("@simplewebauthn/server/helpers", () => ({
  decodeCredentialPublicKey: vi.fn(),
  cose: {
    COSEKEYS: { alg: 3 },
  },
}));

const { decodeCredentialPublicKey } = await import("@simplewebauthn/server/helpers");

describe("SimpleWebAuthnRegistrationAdapter", () => {
  const adapter = new SimpleWebAuthnRegistrationAdapter({
    rpId: "localhost",
    rpName: "Calibrate",
    origin: "http://localhost:3000",
  });

  beforeEach(() => {
    vi.mocked(generateRegistrationOptions).mockReset();
    vi.mocked(verifyRegistrationResponse).mockReset();
    vi.mocked(decodeCredentialPublicKey).mockReset();
  });

  it("creates discoverable registration options with no attestation", async () => {
    vi.mocked(generateRegistrationOptions).mockResolvedValue({
      challenge: "challenge",
      rp: { name: "Calibrate", id: "localhost" },
      user: { id: "handle", name: "person@example.com", displayName: "person@example.com" },
      pubKeyCredParams: [],
    });

    const userHandle = randomBytes(32).toString("base64url");
    const rawChallenge = randomBytes(32).toString("base64url");

    await adapter.createRegistrationOptions({
      userHandle,
      email: "person@example.com",
      rawChallenge,
    });

    expect(generateRegistrationOptions).toHaveBeenCalledWith({
      rpName: "Calibrate",
      rpID: "localhost",
      userName: "person@example.com",
      userDisplayName: "person@example.com",
      userID: Buffer.from(userHandle, "base64url"),
      challenge: Buffer.from(rawChallenge, "base64url"),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });
  });

  it("passes every active credential as an exclusion descriptor", async () => {
    vi.mocked(generateRegistrationOptions).mockResolvedValue({
      challenge: "challenge",
      rp: { name: "Calibrate", id: "localhost" },
      user: { id: "handle", name: "person@example.com", displayName: "person@example.com" },
      pubKeyCredParams: [],
    });

    await adapter.createRegistrationOptions({
      userHandle: randomBytes(32).toString("base64url"),
      email: "person@example.com",
      rawChallenge: randomBytes(32).toString("base64url"),
      excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
    });

    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
      }),
    );
  });

  it("maps a verified registration response to persisted credential fields", async () => {
    const publicKey = new Uint8Array([9, 9, 9]);
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: "none",
        aaguid: "00000000-0000-0000-0000-000000000000",
        credential: {
          id: "credential-id",
          publicKey,
          counter: 0,
          transports: ["internal"],
        },
        credentialType: "public-key",
        attestationObject: new Uint8Array(),
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: "http://localhost:3000",
      },
    });
    vi.mocked(decodeCredentialPublicKey).mockReturnValue({
      get: () => -7,
      set: vi.fn(),
    } as never);

    const attestation = {
      credentialId: "credential-id",
      rawCredentialId: "credential-id",
      clientDataJSON: "client-data",
      attestationObject: "attestation",
    } satisfies WebAuthnRegistrationAttestation;

    const verified = await adapter.verifyRegistrationResponse({
      attestation,
      expectedChallenge: "challenge",
      expectedOrigin: "http://localhost:3000",
    });

    expect(verified).toEqual({
      credentialId: "credential-id",
      publicKey,
      algorithm: -7,
      transports: ["internal"],
      signatureCounter: 0,
      aaguid: "00000000-0000-0000-0000-000000000000",
      backupEligible: true,
      backupState: true,
    });
    expect(verifyRegistrationResponse).toHaveBeenCalledWith({
      response: {
        id: "credential-id",
        rawId: "credential-id",
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: "client-data",
          attestationObject: "attestation",
        },
      },
      expectedChallenge: "challenge",
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: true,
    });
  });

  it("fails safely when verification does not succeed", async () => {
    vi.mocked(verifyRegistrationResponse).mockResolvedValue({ verified: false });

    await expect(
      adapter.verifyRegistrationResponse({
        attestation: {
          credentialId: "credential-id",
          rawCredentialId: "credential-id",
          clientDataJSON: "client-data",
          attestationObject: "attestation",
        },
        expectedChallenge: "challenge",
        expectedOrigin: "http://localhost:3000",
      }),
    ).rejects.toThrow("Passkey registration verification failed");
  });
});
