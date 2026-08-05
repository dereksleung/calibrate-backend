import type { IClock } from "@application/ports/clock.js";
import type { IWebAuthnRegistrationPort, WebAuthnRegistrationOptions } from "@application/ports/webauthn-registration-port.js";
import type { VerifiedPasskeyCredentialInput } from "@application/ports/signup-passkey-registration-repository.js";
import type { User } from "@domain/entities/user.js";

import {
  EnrollmentAuthorizationRequiredError,
  OriginNotAllowedError,
  PasskeyRegistrationFailedError,
  PasskeyRegistrationStateConflictError,
} from "@application/errors/passkey-registration-errors.js";
import { calculateSessionLifetimes } from "@application/services/session-lifetime-calculator.js";
import { extractChallengeFromClientDataJSON } from "@application/services/signup-passkey-registration-service.js";
import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";

export interface IRecoveryPasskeyRegistrationRepository {
  prepareRegistration(input: { recoveryRegistrationTokenDigest: string; rawChallenge: string; challengeDigest: string; now: Date }): Promise<{
    userHandle: string;
    email: string;
    rawChallenge: string;
    excludeCredentials: Array<{ id: string; transports: string[] }>;
  }>;
  findActiveChallenge(input: { recoveryRegistrationTokenDigest: string; challengeDigest: string; now: Date }): Promise<{
    challengeId: string;
  } | null>;
  recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void>;
  completeRegistration(input: {
    recoveryRegistrationTokenDigest: string;
    challengeDigest: string;
    now: Date;
    restrictionEndsAt: Date;
    passkey: VerifiedPasskeyCredentialInput;
    accessTokenDigest: string;
    refreshTokenDigest: string;
    accessInactivityExpiresAt: Date;
    accessAbsoluteExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
    securityEventId: string;
  }): Promise<{
    user: User;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }>;
}

export interface IRecoveryPasskeyRegistrationService {
  createRegistrationOptions(token: string, origin: string): Promise<{ options: WebAuthnRegistrationOptions }>;
  verifyRegistration(input: {
    recoveryRegistrationToken: string;
    origin: string;
    attestation: Parameters<IWebAuthnRegistrationPort["verifyRegistrationResponse"]>[0]["attestation"];
    rememberDevice: boolean;
  }): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    rememberDevice: boolean;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }>;
}

export class RecoveryPasskeyRegistrationServiceImpl implements IRecoveryPasskeyRegistrationService {
  constructor(
    private readonly repository: IRecoveryPasskeyRegistrationRepository,
    private readonly webAuthn: IWebAuthnRegistrationPort,
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

  async verifyRegistration(input: {
    recoveryRegistrationToken: string;
    origin: string;
    attestation: Parameters<IWebAuthnRegistrationPort["verifyRegistrationResponse"]>[0]["attestation"];
    rememberDevice: boolean;
  }) {
    if (input.origin !== this.config.expectedOrigin) throw new OriginNotAllowedError();
    const now = this.clock.now();
    let responseChallenge: string;
    try {
      responseChallenge = extractChallengeFromClientDataJSON(input.attestation.clientDataJSON);
    } catch {
      throw new PasskeyRegistrationFailedError();
    }
    const recoveryRegistrationTokenDigest = createHash("sha256")
      .update(input.recoveryRegistrationToken)
      .digest("base64url");
    const activeChallenge = await this.repository.findActiveChallenge({
      recoveryRegistrationTokenDigest,
      challengeDigest: createHash("sha256").update(responseChallenge).digest("base64url"),
      now,
    });
    if (!activeChallenge) throw new EnrollmentAuthorizationRequiredError();

    let credential;
    try {
      credential = await this.webAuthn.verifyRegistrationResponse({
        attestation: input.attestation,
        expectedChallenge: responseChallenge,
        expectedOrigin: this.config.expectedOrigin,
      });
    } catch {
      await this.repository.recordFailedVerificationAttempt({ challengeId: activeChallenge.challengeId, now });
      throw new PasskeyRegistrationFailedError();
    }
    if (!credential.backupEligible && credential.backupState) {
      await this.repository.recordFailedVerificationAttempt({ challengeId: activeChallenge.challengeId, now });
      throw new PasskeyRegistrationFailedError();
    }

    const accessToken = randomBytes(32).toString("base64url");
    const refreshToken = randomBytes(32).toString("base64url");
    const lifetimes = calculateSessionLifetimes(now);
    try {
      const result = await this.repository.completeRegistration(
        {
          recoveryRegistrationTokenDigest,
          challengeDigest: createHash("sha256").update(responseChallenge).digest("base64url"),
          now,
          restrictionEndsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          passkey: credential,
          accessTokenDigest: createHash("sha256").update(accessToken).digest("base64url"),
          refreshTokenDigest: createHash("sha256").update(refreshToken).digest("base64url"),
          accessInactivityExpiresAt: lifetimes.accessInactivityExpiresAt,
          accessAbsoluteExpiresAt: lifetimes.accessAbsoluteExpiresAt,
          familyInactivityExpiresAt: lifetimes.familyInactivityExpiresAt,
          familyAbsoluteExpiresAt: lifetimes.familyAbsoluteExpiresAt,
          securityEventId: randomUUID(),
        },
      );
      return { ...result, accessToken, refreshToken, rememberDevice: input.rememberDevice };
    } catch (error) {
      if (error instanceof EnrollmentAuthorizationRequiredError || error instanceof PasskeyRegistrationStateConflictError) throw error;
      throw new PasskeyRegistrationStateConflictError();
    }
  }
}
