import type { IClock } from "@application/ports/clock.js";
import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { IUserRepository } from "@application/ports/user-repository.js";
import type {
  IWebAuthnAuthenticationPort,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";
import type { AuthenticationResponseJSON } from "@calibrate/api-contracts";

import {
  PasskeyAuthenticationFailedError,
  PasskeyAuthenticationStateConflictError,
  PasskeyAuthenticationUnavailableError,
} from "@application/errors/passkey-authentication-errors.js";
import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
import type { User } from "@domain/entities/user.js";
import { createHash, randomBytes } from "node:crypto";

import { calculateSessionLifetimes } from "./session-lifetime-calculator.js";

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
    rememberDevice: boolean;
  }): Promise<VerifyPasskeyAuthenticationResult>;
}

export interface VerifyPasskeyAuthenticationResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  rememberDevice: boolean;
  accessInactivityExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export class PasskeyAuthenticationServiceImpl implements IPasskeyAuthenticationService {
  constructor(
    private readonly repository: IPasskeyAuthenticationRepository,
    private readonly webAuthnAuthentication: IWebAuthnAuthenticationPort,
    private readonly opaqueTokenService: IOpaqueTokenService,
    private readonly userRepository: IUserRepository,
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
    rememberDevice: boolean;
  }): Promise<VerifyPasskeyAuthenticationResult> {
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
    let verified: Awaited<ReturnType<IWebAuthnAuthenticationPort["verifyAuthenticationResponse"]>>;
    let counterAnomaly: boolean;
    try {
      verified = await this.webAuthnAuthentication.verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: this.config.expectedOrigin,
        credential: active,
      });
      if (!verified.backupEligible && verified.backupState) throw new Error();
      counterAnomaly = verified.newCounter <= active.signatureCounter;
      if (counterAnomaly && !verified.backupEligible) throw new Error();
    } catch {
      await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
    const accessToken = this.opaqueTokenService.create();
    const refreshToken = this.opaqueTokenService.create();
    const lifetimes = calculateSessionLifetimes(now);
    let completed: { userId: string };
    try {
      completed = await this.repository.completeAuthentication({
        challengeDigest: createHash("sha256").update(challenge).digest("base64url"),
        credentialId: active.credentialId,
        now,
        newCounter: Math.max(active.signatureCounter, verified.newCounter),
        backupState: verified.backupState,
        counterAnomaly,
        accessTokenDigest: accessToken.digest,
        refreshTokenDigest: refreshToken.digest,
        ...lifetimes,
      });
    } catch (error) {
      if (error instanceof PasskeyAuthenticationStateConflictError) throw error;
      throw new PasskeyAuthenticationUnavailableError();
    }
    let user: User | null;
    try {
      user = await this.userRepository.findById(completed.userId);
    } catch {
      throw new PasskeyAuthenticationUnavailableError();
    }
    if (!user) throw new PasskeyAuthenticationStateConflictError();
    return {
      user,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      rememberDevice: input.rememberDevice,
      accessInactivityExpiresAt: lifetimes.accessInactivityExpiresAt,
      familyInactivityExpiresAt: lifetimes.familyInactivityExpiresAt,
      familyAbsoluteExpiresAt: lifetimes.familyAbsoluteExpiresAt,
    };
  }
}

export class UnavailablePasskeyAuthenticationService implements IPasskeyAuthenticationService {
  createAuthenticationOptions(): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }> {
    throw new PasskeyAuthenticationUnavailableError();
  }

  verifyAuthentication(): Promise<VerifyPasskeyAuthenticationResult> {
    throw new PasskeyAuthenticationUnavailableError();
  }
}
