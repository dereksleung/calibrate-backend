import type { IClock } from "@application/ports/clock.js";
import type {
  IWebAuthnAuthenticationPort,
  WebAuthnAuthenticationAssertion,
  WebAuthnAuthenticationOptions,
} from "@application/ports/webauthn-authentication-port.js";
import type { User } from "@domain/entities/user.js";

import {
  PasskeyAuthenticationFailedError,
  PasskeyAuthenticationStateConflictError,
} from "@application/errors/passkey-authentication-errors.js";
import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
import { calculateSessionLifetimes } from "@application/services/session-lifetime-calculator.js";
import { createHash, randomBytes } from "node:crypto";

export interface IRecoveryPromotionRepository {
  preparePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    rawChallenge: string;
    now: Date;
  }): Promise<{
    rawChallenge: string;
    expiresAt: Date;
    allowCredentials: Array<{ id: string; transports: string[] }>;
  }>;
  findActivePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    credentialId: string;
    now: Date;
  }): Promise<{
    challengeId: string;
    userHandle: string;
    credentialId: string;
    publicKey: Uint8Array;
    signatureCounter: number;
    transports: string[];
    backupEligible: boolean;
    backupState: boolean;
  } | null>;
  recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void>;
  completePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    credentialId: string;
    newCounter: number;
    backupState: boolean;
    accessTokenDigestNew: string;
    refreshTokenDigest: string;
    now: Date;
    accessInactivityExpiresAt: Date;
    accessAbsoluteExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }): Promise<{ user: User }>;
}

export class RecoveryPromotionServiceImpl {
  constructor(
    private readonly repository: IRecoveryPromotionRepository,
    private readonly webAuthn: IWebAuthnAuthenticationPort,
    private readonly clock: IClock,
    private readonly config: { expectedOrigin: string },
  ) {}

  async createOptions(input: {
    accessToken: string;
    origin: string;
  }): Promise<{ options: WebAuthnAuthenticationOptions; expiresAt: Date }> {
    if (input.origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();
    const rawChallenge = randomBytes(32).toString("base64url");
    const prepared = await this.repository.preparePromotion({
      accessTokenDigest: digest(input.accessToken),
      challengeDigest: digest(rawChallenge),
      rawChallenge,
      now: this.clock.now(),
    });
    return {
      options: await this.webAuthn.createAuthenticationOptions({
        rawChallenge: prepared.rawChallenge,
        allowCredentials: prepared.allowCredentials,
      }),
      expiresAt: prepared.expiresAt,
    };
  }

  async verify(input: {
    accessToken: string;
    origin: string;
    assertion: WebAuthnAuthenticationAssertion;
    rememberDevice: boolean;
  }): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    rememberDevice: boolean;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }> {
    if (input.origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();
    const now = this.clock.now();
    let challenge: string;
    try {
      const parsed = JSON.parse(Buffer.from(input.assertion.clientDataJSON, "base64url").toString("utf8"));
      if (typeof parsed.challenge !== "string") throw new Error();
      challenge = parsed.challenge;
    } catch {
      throw new PasskeyAuthenticationFailedError();
    }
    const active = await this.repository.findActivePromotion({
      accessTokenDigest: digest(input.accessToken),
      challengeDigest: digest(challenge),
      credentialId: input.assertion.credentialId,
      now,
    });
    if (!active || active.userHandle !== input.assertion.userHandle)
      throw new PasskeyAuthenticationFailedError();
    let verified;
    try {
      verified = await this.webAuthn.verifyAuthenticationResponse({
        assertion: input.assertion,
        expectedChallenge: challenge,
        expectedOrigin: this.config.expectedOrigin,
        credential: active,
      });
    } catch {
      await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
    if (
      (!verified.backupEligible && verified.backupState) ||
      (!verified.backupEligible && verified.newCounter <= active.signatureCounter)
    ) {
      await this.repository.recordFailedVerificationAttempt({ challengeId: active.challengeId, now });
      throw new PasskeyAuthenticationFailedError();
    }
    const accessToken = randomBytes(32).toString("base64url");
    const refreshToken = randomBytes(32).toString("base64url");
    const lifetime = calculateSessionLifetimes(now);
    try {
      const result = await this.repository.completePromotion({
        accessTokenDigest: digest(input.accessToken),
        challengeDigest: digest(challenge),
        credentialId: active.credentialId,
        newCounter: Math.max(active.signatureCounter, verified.newCounter),
        backupState: verified.backupState,
        accessTokenDigestNew: digest(accessToken),
        refreshTokenDigest: digest(refreshToken),
        now,
        ...lifetime,
      });
      return {
        ...result,
        accessToken,
        refreshToken,
        rememberDevice: input.rememberDevice,
        accessInactivityExpiresAt: lifetime.accessInactivityExpiresAt,
        familyInactivityExpiresAt: lifetime.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: lifetime.familyAbsoluteExpiresAt,
      };
    } catch (error) {
      if (error instanceof PasskeyAuthenticationStateConflictError) throw error;
      throw new PasskeyAuthenticationStateConflictError();
    }
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
