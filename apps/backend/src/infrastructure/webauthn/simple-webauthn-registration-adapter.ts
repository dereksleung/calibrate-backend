import type { RegistrationResponseJSON } from "@calibrate/api-contracts";
import type {
  IWebAuthnRegistrationPort,
  RegistrationOptionsInput,
  VerifiedRegistrationCredential,
} from "@application/ports/webauthn-registration-port.js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";

export interface SimpleWebAuthnRegistrationConfig {
  rpId: string;
  rpName: string;
  origin: string;
}

export class SimpleWebAuthnRegistrationAdapter implements IWebAuthnRegistrationPort {
  constructor(private readonly config: SimpleWebAuthnRegistrationConfig) {}

  async createRegistrationOptions(input: RegistrationOptionsInput): Promise<Record<string, unknown>> {
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userName: input.email,
      userDisplayName: input.email,
      userID: Buffer.from(input.userHandle, "base64url"),
      challenge: input.rawChallenge,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });

    return options as unknown as Record<string, unknown>;
  }

  async verifyRegistrationResponse(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string;
  }): Promise<VerifiedRegistrationCredential> {
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: this.config.rpId,
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration verification failed");
    }

    const { registrationInfo } = verification;
    const cosePublicKey = decodeCredentialPublicKey(registrationInfo.credential.publicKey);
    const algorithm = cosePublicKey.get(cose.COSEKEYS.alg);
    if (algorithm === undefined) {
      throw new Error("Passkey registration verification failed");
    }

    return {
      credentialId: registrationInfo.credential.id,
      publicKey: registrationInfo.credential.publicKey,
      algorithm,
      transports: registrationInfo.credential.transports ?? [],
      signatureCounter: registrationInfo.credential.counter,
      aaguid: registrationInfo.aaguid,
      backupEligible: registrationInfo.credentialDeviceType === "multiDevice",
      backupState: registrationInfo.credentialBackedUp,
    };
  }
}
