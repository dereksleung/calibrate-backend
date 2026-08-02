import type { IClock } from "@application/ports/clock.js";
import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type {
  IWebAuthnAuthenticationPort,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";

import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
import { PasskeyAuthenticationUnavailableError } from "@application/errors/passkey-authentication-errors.js";
import { createHash, randomBytes } from "node:crypto";

const MAX_OPTIONS_REQUESTS_PER_IP = 40;
const GLOBAL_HOURLY_LIMIT = 10_000;
const MAX_VERIFICATION_ATTEMPTS = 5;

export interface PasskeyAuthenticationServiceConfig {
  expectedOrigin: string;
}

export interface CreatePasskeyAuthenticationOptionsInput {
  origin: string;
  requestingIp: string;
}

export interface IPasskeyAuthenticationService {
  createAuthenticationOptions(
    input: CreatePasskeyAuthenticationOptionsInput,
  ): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }>;
}

export class PasskeyAuthenticationServiceImpl implements IPasskeyAuthenticationService {
  constructor(
    private readonly repository: IPasskeyAuthenticationRepository,
    private readonly webAuthnAuthentication: IWebAuthnAuthenticationPort,
    private readonly clock: IClock,
    private readonly config: PasskeyAuthenticationServiceConfig,
  ) {}

  async createAuthenticationOptions(
    input: CreatePasskeyAuthenticationOptionsInput,
  ): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }> {
    if (input.origin !== this.config.expectedOrigin) {
      throw new OriginNotAllowedError();
    }

    const rawChallenge = randomBytes(32).toString("base64url");
    const prepared = await this.repository.prepareAuthentication({
      rawChallenge,
      challengeDigest: createHash("sha256").update(rawChallenge).digest("base64url"),
      requestingIp: input.requestingIp,
      now: this.clock.now(),
      maxOptionsRequestsPerIp: MAX_OPTIONS_REQUESTS_PER_IP,
      globalHourlyLimit: GLOBAL_HOURLY_LIMIT,
      maxVerificationAttempts: MAX_VERIFICATION_ATTEMPTS,
    });

    return {
      options: await this.webAuthnAuthentication.createAuthenticationOptions({
        rawChallenge: prepared.rawChallenge,
      }),
      expiresAt: prepared.challengeExpiresAt,
    };
  }
}

export class UnavailablePasskeyAuthenticationService implements IPasskeyAuthenticationService {
  createAuthenticationOptions(): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }> {
    throw new PasskeyAuthenticationUnavailableError();
  }
}
