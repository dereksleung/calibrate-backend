import type { AuthenticationResponseJSON } from "@calibrate/api-contracts";

import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SimpleWebAuthnAuthenticationAdapter } from "../simple-webauthn-authentication-adapter.js";

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

const credential = {
  id: "credential-id",
  rawId: "credential-id",
  type: "public-key",
  clientExtensionResults: {},
  response: {
    authenticatorData: "authenticator-data",
    clientDataJSON: "client-data",
    signature: "signature",
    userHandle: "user-handle",
  },
} satisfies AuthenticationResponseJSON;

describe("SimpleWebAuthnAuthenticationAdapter", () => {
  const adapter = new SimpleWebAuthnAuthenticationAdapter({ rpId: "localhost" });

  beforeEach(() => {
    vi.mocked(generateAuthenticationOptions).mockReset();
    vi.mocked(verifyAuthenticationResponse).mockReset();
  });

  it("creates usernameless authentication options requiring user verification", async () => {
    const rawChallenge = Buffer.from("challenge").toString("base64url");
    vi.mocked(generateAuthenticationOptions).mockResolvedValue({
      challenge: rawChallenge,
      rpId: "localhost",
      timeout: 300_000,
      userVerification: "required",
    });

    await adapter.createAuthenticationOptions({ rawChallenge });

    expect(generateAuthenticationOptions).toHaveBeenCalledWith({
      rpID: "localhost",
      challenge: Buffer.from(rawChallenge, "base64url"),
      timeout: 300_000,
      userVerification: "required",
    });
  });

  it("verifies an assertion using only persisted credential data and trusted ceremony values", async () => {
    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-id",
        newCounter: 4,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        userVerified: true,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const verified = await adapter.verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: "challenge",
      expectedOrigin: "http://localhost:3000",
      credential: {
        credentialId: "credential-id",
        publicKey: new Uint8Array([1, 2, 3]),
        signatureCounter: 3,
        transports: ["internal"],
      },
    });

    expect(verified).toEqual({
      newCounter: 4,
      backupEligible: false,
      backupState: false,
    });
    expect(verifyAuthenticationResponse).toHaveBeenCalledWith({
      response: credential,
      expectedChallenge: "challenge",
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      expectedType: "webauthn.get",
      requireUserVerification: true,
      credential: {
        id: "credential-id",
        publicKey: Buffer.from([1, 2, 3]),
        counter: 3,
      },
    });
  });
});
