export interface AuthenticationOptionsInput {
  rawChallenge: string;
  allowCredentials?: Array<{ id: string; transports: string[] }>;
}

/** Protocol fields the authentication use case needs from a WebAuthn assertion. */
export interface WebAuthnAuthenticationAssertion {
  credentialId: string;
  rawCredentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId: string;
  timeout: 300_000;
  userVerification: "required";
  allowCredentials?: Array<{ id: string; type: "public-key"; transports?: string[] }>;
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
    assertion: WebAuthnAuthenticationAssertion;
    expectedChallenge: string;
    expectedOrigin: string;
    credential: PersistedAuthenticationCredential;
  }): Promise<VerifiedAuthenticationCredential>;
}
