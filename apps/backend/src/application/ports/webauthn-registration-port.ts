export interface RegistrationOptionsInput {
  userHandle: string;
  email: string;
  rawChallenge: string;
}

/** Protocol fields required to verify a WebAuthn registration attestation. */
export interface WebAuthnRegistrationAttestation {
  credentialId: string;
  rawCredentialId: string;
  clientDataJSON: string;
  attestationObject: string;
  transports?: Array<"usb" | "nfc" | "ble" | "internal" | "hybrid" | "smart-card">;
}

/** JSON-serializable options for a WebAuthn registration ceremony. */
export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id?: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: ReadonlyArray<{
    type: "public-key";
    alg: number;
  }>;
  timeout?: number;
  excludeCredentials?: ReadonlyArray<{
    id: string;
    type: "public-key";
    transports?: ReadonlyArray<string>;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform";
    requireResidentKey?: boolean;
    residentKey?: "discouraged" | "preferred" | "required";
    userVerification?: "discouraged" | "preferred" | "required";
  };
  hints?: ReadonlyArray<"security-key" | "client-device" | "hybrid">;
  attestation?: "none" | "indirect" | "direct" | "enterprise";
  extensions?: {
    appid?: string;
    credProps?: boolean;
    hmacCreateSecret?: boolean;
    minPinLength?: boolean;
  };
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
  createRegistrationOptions(input: RegistrationOptionsInput): Promise<WebAuthnRegistrationOptions>;

  verifyRegistrationResponse(input: {
    attestation: WebAuthnRegistrationAttestation;
    expectedChallenge: string;
    expectedOrigin: string;
  }): Promise<VerifiedRegistrationCredential>;
}
