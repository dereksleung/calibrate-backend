import type { AuthenticationResponseJSON } from "@calibrate/api-contracts";

export interface AuthenticationOptionsInput {
  rawChallenge: string;
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId: string;
  timeout: 300_000;
  userVerification: "required";
}

export interface PersistedAuthenticationCredential {
  credentialId: string;
  publicKey: Uint8Array;
  signatureCounter: number;
  transports: string[];
}

export interface VerifiedAuthenticationCredential {
  newCounter: number;
  backupEligible: boolean;
  backupState: boolean;
}

export interface IWebAuthnAuthenticationPort {
  createAuthenticationOptions(input: AuthenticationOptionsInput): Promise<WebAuthnAuthenticationOptions>;

  verifyAuthenticationResponse(input: {
    response: AuthenticationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string;
    credential: PersistedAuthenticationCredential;
  }): Promise<VerifiedAuthenticationCredential>;
}
