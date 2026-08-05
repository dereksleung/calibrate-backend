import type { IClock } from "@application/ports/clock.js";
import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { IUserRepository } from "@application/ports/user-repository.js";
import type {
  IWebAuthnAuthenticationPort,
  WebAuthnAuthenticationAssertion,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";
import type { User } from "@domain/entities/user.js";

import {
  PasskeyAuthenticationFailedError,
  PasskeyAuthenticationStateConflictError,
  PasskeyAuthenticationUnavailableError,
} from "@application/errors/passkey-authentication-errors.js";
import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
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

  createIdentifiedAuthenticationOptions(input: {
    origin: string;
    requestingIp: string;
    accountAccessToken: string;
  }): Promise<{
    options: WebAuthnAuthenticationOptions & {
      allowCredentials: NonNullable<WebAuthnAuthenticationOptions["allowCredentials"]>;
    };
    expiresAt: Date;
  }>;

  verifyAuthentication(input: {
    origin: string;
    requestingIp: string;
    assertion: WebAuthnAuthenticationAssertion;
    rememberDevice: boolean;
  }): Promise<VerifyPasskeyAuthenticationResult>;

  verifyIdentifiedAuthentication(input: {
    origin: string;
    requestingIp: string;
    accountAccessToken: string;
    assertion: WebAuthnAuthenticationAssertion;
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

  async createIdentifiedAuthenticationOptions(input: {
    origin: string;
    requestingIp: string;
    accountAccessToken: string;
  }): Promise<{
    options: WebAuthnAuthenticationOptions & {
      allowCredentials: NonNullable<WebAuthnAuthenticationOptions["allowCredentials"]>;
    };
    expiresAt: Date;
  }> {
    if (input.origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();

    const rawChallenge = randomBytes(32).toString("base64url");
    const prepared = await this.repository.prepareIdentifiedAuthentication({
      rawChallenge,
      challengeDigest: createHash("sha256").update(rawChallenge).digest("base64url"),
      accountAccessTokenDigest: createHash("sha256").update(input.accountAccessToken).digest("base64url"),
      clientBinding: "cookie",
      requestingIp: input.requestingIp,
      now: this.clock.now(),
      maxOptionsRequestsPerIp: MAX_OPTIONS_REQUESTS_PER_IP,
      globalHourlyLimit: GLOBAL_HOURLY_LIMIT,
      maxVerificationAttempts: MAX_VERIFICATION_ATTEMPTS,
    });
    const options = await this.webAuthnAuthentication.createAuthenticationOptions({
      rawChallenge: prepared.rawChallenge,
      allowCredentials: prepared.allowCredentials,
    });
    const allowCredentials = options.allowCredentials;
    if (!allowCredentials?.length) throw new PasskeyAuthenticationStateConflictError();
    return { options: { ...options, allowCredentials }, expiresAt: prepared.challengeExpiresAt };
  }

  async verifyAuthentication(input: {
    origin: string;
    requestingIp: string;
    assertion: WebAuthnAuthenticationAssertion;
    rememberDevice: boolean;
  }): Promise<VerifyPasskeyAuthenticationResult> {
    return this.verify(input);
  }

  async verifyIdentifiedAuthentication(input: {
    origin: string;
    requestingIp: string;
    accountAccessToken: string;
    assertion: WebAuthnAuthenticationAssertion;
    rememberDevice: boolean;
  }): Promise<VerifyPasskeyAuthenticationResult> {
    return this.verify(input, input.accountAccessToken);
  }

  private async verify(
    input: {
      origin: string;
      requestingIp: string;
      assertion: WebAuthnAuthenticationAssertion;
      rememberDevice: boolean;
    },
    accountAccessToken?: string,
  ): Promise<VerifyPasskeyAuthenticationResult> {
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
      const parsed = JSON.parse(Buffer.from(input.assertion.clientDataJSON, "base64url").toString("utf8"));
      if (typeof parsed.challenge !== "string") throw new Error();
      challenge = parsed.challenge;
    } catch {
      throw new PasskeyAuthenticationFailedError();
    }
    const challengeDigest = createHash("sha256").update(challenge).digest("base64url");
    const accountAccessTokenDigest = accountAccessToken
      ? createHash("sha256").update(accountAccessToken).digest("base64url")
      : undefined;
    const active = accountAccessTokenDigest
      ? await this.repository.findActiveIdentifiedCredential({
          credentialId: input.assertion.credentialId,
          challengeDigest,
          accountAccessTokenDigest,
          clientBinding: "cookie",
          now,
        })
      : await this.repository.findActiveCredential({
          credentialId: input.assertion.credentialId,
          challengeDigest,
          now,
        });
    if (!active || input.assertion.userHandle !== active.userHandle) {
      if (active)
        await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
    let verified: Awaited<ReturnType<IWebAuthnAuthenticationPort["verifyAuthenticationResponse"]>>;
    let counterAnomaly: boolean;
    try {
      verified = await this.webAuthnAuthentication.verifyAuthenticationResponse({
        assertion: input.assertion,
        expectedChallenge: challenge,
        expectedOrigin: this.config.expectedOrigin,
        credential: active,
      });

      // !backupEligible means a single-device-only passkey, backupState === true means it was backed up
      if (!verified.backupEligible && verified.backupState) throw new Error();
      counterAnomaly = verified.newCounter <= active.signatureCounter;

      // !backupEligible means a single-device-only passkey.
      // Only for single-device passkeys should we allow a counter anomaly to signal a replay attack
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
      const completion = {
        challengeDigest,
        credentialId: active.credentialId,
        now,
        newCounter: Math.max(active.signatureCounter, verified.newCounter),
        backupState: verified.backupState,
        counterAnomaly,
        accessTokenDigest: accessToken.digest,
        refreshTokenDigest: refreshToken.digest,
        ...lifetimes,
      };
      completed = accountAccessTokenDigest
        ? await this.repository.completeIdentifiedAuthentication({
            ...completion,
            accountAccessTokenDigest,
            clientBinding: "cookie",
          })
        : await this.repository.completeAuthentication(completion);
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

  createIdentifiedAuthenticationOptions(): Promise<{
    options: WebAuthnAuthenticationOptions & {
      allowCredentials: NonNullable<WebAuthnAuthenticationOptions["allowCredentials"]>;
    };
    expiresAt: Date;
  }> {
    throw new PasskeyAuthenticationUnavailableError();
  }

  verifyAuthentication(): Promise<VerifyPasskeyAuthenticationResult> {
    throw new PasskeyAuthenticationUnavailableError();
  }

  verifyIdentifiedAuthentication(): Promise<VerifyPasskeyAuthenticationResult> {
    throw new PasskeyAuthenticationUnavailableError();
  }
}
