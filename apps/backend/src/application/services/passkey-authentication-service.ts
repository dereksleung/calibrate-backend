import type { IClock } from "@application/ports/clock.js";
import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type {
  IWebAuthnAuthenticationPort,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";
import type { AuthenticationResponseJSON } from "@calibrate/api-contracts";

import {
  PasskeyAuthenticationFailedError,
  PasskeyAuthenticationUnavailableError,
} from "@application/errors/passkey-authentication-errors.js";
import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
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

  verifyAuthentication(input: {
    origin: string;
    requestingIp: string;
    credential: AuthenticationResponseJSON;
  }): Promise<{ credentialId: string; newCounter: number; counterAnomaly: boolean }>;
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

  async verifyAuthentication(input: {
    origin: string;
    requestingIp: string;
    credential: AuthenticationResponseJSON;
  }): Promise<{ credentialId: string; newCounter: number; counterAnomaly: boolean }> {
    if (input.origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();
    const now = this.clock.now();
    await this.repository.consumeVerificationRateLimit({
      requestingIp: input.requestingIp,
      now,
      maxVerificationRequestsPerIp: 30,
      globalHourlyLimit: GLOBAL_HOURLY_LIMIT,
    });
    let challenge: string;
    try {
      const parsed = JSON.parse(
        Buffer.from(input.credential.response.clientDataJSON, "base64url").toString("utf8"),
      );
      if (typeof parsed.challenge !== "string") throw new Error();
      challenge = parsed.challenge;
    } catch {
      throw new PasskeyAuthenticationFailedError();
    }
    const active = await this.repository.findActiveCredential({
      credentialId: input.credential.id,
      challengeDigest: createHash("sha256").update(challenge).digest("base64url"),
      now,
    });
    if (!active || input.credential.response.userHandle !== active.userHandle) {
      if (active)
        await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
    try {
      const verified = await this.webAuthnAuthentication.verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: this.config.expectedOrigin,
        credential: active,
      });
      if (!verified.backupEligible && verified.backupState) throw new Error();
      const counterAnomaly = verified.newCounter <= active.signatureCounter;
      if (counterAnomaly && !verified.backupEligible) throw new Error();
      return { credentialId: active.credentialId, newCounter: verified.newCounter, counterAnomaly };
    } catch {
      await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
  }
}

export class UnavailablePasskeyAuthenticationService implements IPasskeyAuthenticationService {
  createAuthenticationOptions(): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }> {
    throw new PasskeyAuthenticationUnavailableError();
  }

  verifyAuthentication(): Promise<{ credentialId: string; newCounter: number; counterAnomaly: boolean }> {
    throw new PasskeyAuthenticationUnavailableError();
  }
}
