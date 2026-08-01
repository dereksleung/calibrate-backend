import type {
  IWebAuthnRegistrationPort,
  WebAuthnRegistrationOptions,
} from "@application/ports/webauthn-registration-port.js";
import type { RegistrationResponseJSON } from "@calibrate/api-contracts";

import {
  EnrollmentAuthorizationRequiredError,
  OriginNotAllowedError,
  PasskeyRegistrationFailedError,
  PasskeyRegistrationRateLimitedError,
  PasskeyRegistrationStateConflictError,
  PasskeyRegistrationUnavailableError,
} from "@application/errors/passkey-registration-errors.js";
import { IClock } from "@application/ports/clock.js";
import { IEmailSender } from "@application/ports/email-sender.js";
import { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import {
  ISignupPasskeyRegistrationRepository,
  SIGNUP_PASSKEY_REGISTRATION_PURPOSE,
} from "@application/ports/signup-passkey-registration-repository.js";
import { User } from "@domain/entities/user.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const MAX_OPTIONS_REQUESTS = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const ACCESS_INACTIVITY_MS = 30 * 60 * 1000;
const ACCESS_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const FAMILY_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const FAMILY_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SignupPasskeyRegistrationServiceConfig {
  expectedOrigin: string;
}

export interface CreateRegistrationOptionsResult {
  options: WebAuthnRegistrationOptions;
}

export interface VerifyPasskeyRegistrationInput {
  enrollmentToken: string;
  origin: string;
  credential: RegistrationResponseJSON;
  rememberDevice: boolean;
}

export interface VerifyPasskeyRegistrationResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  rememberDevice: boolean;
  accessInactivityExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface ISignupPasskeyRegistrationService {
  createRegistrationOptions(
    enrollmentToken: string,
    origin: string,
  ): Promise<CreateRegistrationOptionsResult>;

  verifyRegistration(input: VerifyPasskeyRegistrationInput): Promise<VerifyPasskeyRegistrationResult>;
}

export function digestEnrollmentToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function digestChallenge(challenge: string): string {
  return createHash("sha256").update(challenge).digest("base64url");
}

export function extractChallengeFromClientDataJSON(clientDataJSON: string): string {
  const parsed = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8")) as {
    challenge?: string;
  };
  if (!parsed.challenge || typeof parsed.challenge !== "string") {
    throw new PasskeyRegistrationFailedError();
  }
  return parsed.challenge;
}

export class SignupPasskeyRegistrationServiceImpl implements ISignupPasskeyRegistrationService {
  constructor(
    private readonly repository: ISignupPasskeyRegistrationRepository,
    private readonly webAuthnRegistration: IWebAuthnRegistrationPort,
    private readonly opaqueTokenService: IOpaqueTokenService,
    private readonly emailSender: IEmailSender,
    private readonly clock: IClock,
    private readonly config: SignupPasskeyRegistrationServiceConfig,
  ) {}

  async createRegistrationOptions(
    enrollmentToken: string,
    origin: string,
  ): Promise<CreateRegistrationOptionsResult> {
    this.assertOrigin(origin);
    const now = this.clock.now();
    const rawChallenge = randomBytes(32).toString("base64url");
    const candidateUserHandle = randomBytes(32).toString("base64url");

    try {
      const prepared = await this.repository.prepareRegistration({
        enrollmentTokenDigest: digestEnrollmentToken(enrollmentToken),
        candidateUserHandle,
        rawChallenge,
        challengeDigest: digestChallenge(rawChallenge),
        now,
        maxOptionsRequests: MAX_OPTIONS_REQUESTS,
        maxVerificationAttempts: MAX_VERIFICATION_ATTEMPTS,
      });

      const options = await this.webAuthnRegistration.createRegistrationOptions({
        userHandle: prepared.userHandle,
        email: prepared.email,
        rawChallenge: prepared.rawChallenge,
      });

      return { options };
    } catch (error) {
      if (error instanceof PasskeyRegistrationRateLimitedError) {
        throw error;
      }
      if (error instanceof EnrollmentAuthorizationRequiredError) {
        throw error;
      }
      throw error;
    }
  }

  async verifyRegistration(input: VerifyPasskeyRegistrationInput): Promise<VerifyPasskeyRegistrationResult> {
    this.assertOrigin(input.origin);
    const now = this.clock.now();
    const responseChallenge = extractChallengeFromClientDataJSON(input.credential.response.clientDataJSON);
    const challengeDigest = digestChallenge(responseChallenge);

    const activeChallenge = await this.repository.findActiveChallenge({
      enrollmentTokenDigest: digestEnrollmentToken(input.enrollmentToken),
      challengeDigest,
      now,
    });

    if (!activeChallenge) {
      throw new EnrollmentAuthorizationRequiredError();
    }

    let verifiedCredential;
    try {
      verifiedCredential = await this.webAuthnRegistration.verifyRegistrationResponse({
        response: input.credential,
        expectedChallenge: responseChallenge,
        expectedOrigin: this.config.expectedOrigin,
      });
    } catch {
      await this.repository.recordFailedVerificationAttempt({
        challengeId: activeChallenge.challengeId,
        now,
      });
      throw new PasskeyRegistrationFailedError();
    }

    if (verifiedCredential.backupEligible === false && verifiedCredential.backupState === true) {
      await this.repository.recordFailedVerificationAttempt({
        challengeId: activeChallenge.challengeId,
        now,
      });
      throw new PasskeyRegistrationFailedError();
    }

    const accessToken = this.opaqueTokenService.create();
    const refreshToken = this.opaqueTokenService.create();
    const familyInactivityExpiresAt = new Date(now.getTime() + FAMILY_INACTIVITY_MS);
    const familyAbsoluteExpiresAt = new Date(now.getTime() + FAMILY_ABSOLUTE_MS);
    const accessInactivityExpiresAt = new Date(now.getTime() + ACCESS_INACTIVITY_MS);
    const accessAbsoluteExpiresAt = new Date(
      Math.min(now.getTime() + ACCESS_ABSOLUTE_MS, familyAbsoluteExpiresAt.getTime()),
    );
    const securityEventId = randomUUID();

    const user = User.createForPasskeySignup({
      email: activeChallenge.email,
      webauthnUserHandle: activeChallenge.userHandle,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const result = await this.repository.completeRegistration(
        {
          enrollmentTokenDigest: digestEnrollmentToken(input.enrollmentToken),
          challengeDigest,
          now,
          user,
          passkey: verifiedCredential,
          accessTokenDigest: accessToken.digest,
          refreshTokenDigest: refreshToken.digest,
          accessInactivityExpiresAt,
          accessAbsoluteExpiresAt,
          familyInactivityExpiresAt,
          familyAbsoluteExpiresAt,
          securityEventId,
        },
        accessToken.token,
        refreshToken.token,
      );

      void this.emailSender
        .sendPasskeyAddedNotification({
          email: result.user.email,
          deliveryId: securityEventId,
        })
        .catch(() => undefined);

      return {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        rememberDevice: input.rememberDevice,
        accessInactivityExpiresAt: result.accessInactivityExpiresAt,
        familyInactivityExpiresAt: result.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: result.familyAbsoluteExpiresAt,
      };
    } catch (error) {
      if (error instanceof PasskeyRegistrationStateConflictError) {
        throw error;
      }
      if (error instanceof EnrollmentAuthorizationRequiredError) {
        throw error;
      }
      throw new PasskeyRegistrationStateConflictError();
    }
  }

  private assertOrigin(origin: string): void {
    if (origin !== this.config.expectedOrigin) {
      throw new OriginNotAllowedError();
    }
  }
}

export class UnavailableSignupPasskeyRegistrationService implements ISignupPasskeyRegistrationService {
  createRegistrationOptions(): Promise<CreateRegistrationOptionsResult> {
    throw new PasskeyRegistrationUnavailableError();
  }

  verifyRegistration(): Promise<VerifyPasskeyRegistrationResult> {
    throw new PasskeyRegistrationUnavailableError();
  }
}

export { SIGNUP_PASSKEY_REGISTRATION_PURPOSE };
