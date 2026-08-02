import type {
  AuthenticationOptionsInput,
  IWebAuthnAuthenticationPort,
  VerifiedAuthenticationCredential,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";

import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";

export interface SimpleWebAuthnAuthenticationConfig {
  rpId: string;
}

export class SimpleWebAuthnAuthenticationAdapter implements IWebAuthnAuthenticationPort {
  constructor(private readonly config: SimpleWebAuthnAuthenticationConfig) {}

  async createAuthenticationOptions(
    input: AuthenticationOptionsInput,
  ): Promise<WebAuthnAuthenticationOptions> {
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpId,
      challenge: Buffer.from(input.rawChallenge, "base64url"),
      timeout: 300_000,
      userVerification: "required",
    });
    return {
      challenge: options.challenge,
      rpId: options.rpId ?? this.config.rpId,
      timeout: 300_000,
      userVerification: "required",
    };
  }

  async verifyAuthenticationResponse(input: {
    assertion: Parameters<IWebAuthnAuthenticationPort["verifyAuthenticationResponse"]>[0]["assertion"];
    expectedChallenge: string;
    expectedOrigin: string;
    credential: Parameters<IWebAuthnAuthenticationPort["verifyAuthenticationResponse"]>[0]["credential"];
  }): Promise<VerifiedAuthenticationCredential> {
    const verification = await verifyAuthenticationResponse({
      response: {
        id: input.assertion.credentialId,
        rawId: input.assertion.rawCredentialId,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          authenticatorData: input.assertion.authenticatorData,
          clientDataJSON: input.assertion.clientDataJSON,
          signature: input.assertion.signature,
          userHandle: input.assertion.userHandle,
        },
      },
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: this.config.rpId,
      expectedType: "webauthn.get",
      requireUserVerification: true,
      credential: {
        id: input.credential.credentialId,
        publicKey: Buffer.from(input.credential.publicKey),
        counter: input.credential.signatureCounter,
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      throw new Error("Passkey authentication verification failed");
    }

    return {
      newCounter: verification.authenticationInfo.newCounter,
      backupEligible: verification.authenticationInfo.credentialDeviceType === "multiDevice",
      backupState: verification.authenticationInfo.credentialBackedUp,
    };
  }
}
