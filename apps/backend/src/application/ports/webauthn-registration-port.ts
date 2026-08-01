import type { RegistrationResponseJSON } from "@calibrate/api-contracts";

export interface RegistrationOptionsInput {
  userHandle: string;
  email: string;
  rawChallenge: string;
}

export interface VerifiedRegistrationCredential {
  credentialId: string;
  publicKey: Uint8Array;
  algorithm: number;
  transports: string[];
  signatureCounter: number;
  aaguid: string;
  backupEligible: boolean;
  backupState: boolean;
}

export interface IWebAuthnRegistrationPort {
  createRegistrationOptions(input: RegistrationOptionsInput): Promise<Record<string, unknown>>;

  verifyRegistrationResponse(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string;
  }): Promise<VerifiedRegistrationCredential>;
}
