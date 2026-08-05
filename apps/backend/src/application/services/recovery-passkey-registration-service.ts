import type { IClock } from "@application/ports/clock.js";
import type { IWebAuthnRegistrationPort, WebAuthnRegistrationOptions } from "@application/ports/webauthn-registration-port.js";

import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
import { createHash, randomBytes } from "node:crypto";

export interface IRecoveryPasskeyRegistrationRepository {
  prepareRegistration(input: { recoveryRegistrationTokenDigest: string; rawChallenge: string; challengeDigest: string; now: Date }): Promise<{
    userHandle: string;
    email: string;
    rawChallenge: string;
    excludeCredentials: Array<{ id: string; transports: string[] }>;
  }>;
}

export interface IRecoveryPasskeyRegistrationService {
  createRegistrationOptions(token: string, origin: string): Promise<{ options: WebAuthnRegistrationOptions }>;
}

export class RecoveryPasskeyRegistrationServiceImpl implements IRecoveryPasskeyRegistrationService {
  constructor(
    private readonly repository: IRecoveryPasskeyRegistrationRepository,
    private readonly webAuthn: Pick<IWebAuthnRegistrationPort, "createRegistrationOptions">,
    private readonly clock: IClock,
    private readonly config: { expectedOrigin: string },
  ) {}

  async createRegistrationOptions(token: string, origin: string): Promise<{ options: WebAuthnRegistrationOptions }> {
    if (origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();
    const rawChallenge = randomBytes(32).toString("base64url");
    const prepared = await this.repository.prepareRegistration({
      recoveryRegistrationTokenDigest: createHash("sha256").update(token).digest("base64url"),
      rawChallenge,
      challengeDigest: createHash("sha256").update(rawChallenge).digest("base64url"),
      now: this.clock.now(),
    });
    return {
      options: await this.webAuthn.createRegistrationOptions({
        userHandle: prepared.userHandle,
        email: prepared.email,
        rawChallenge: prepared.rawChallenge,
        excludeCredentials: prepared.excludeCredentials,
      }),
    };
  }
}
