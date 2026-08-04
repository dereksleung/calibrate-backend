import type { MobilePlatform, SessionTransport } from "@application/auth/session-client.js";
import { InvalidEmailVerificationCodeError } from "@application/errors/invalid-email-verification-code-error.js";
import { ServiceUnavailableError } from "@application/errors/service-unavailable-error.js";
import { IClock } from "@application/ports/clock.js";
import { IEmailOtpChallengeRepository } from "@application/ports/email-otp-challenge-repository.js";
import { IEmailOtpCodeService } from "@application/ports/email-otp-code-service.js";
import { IEmailSender } from "@application/ports/email-sender.js";
import { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import { ISignupEnrollmentAuthorizationRepository } from "@application/ports/signup-enrollment-authorization-repository.js";
import { randomUUID } from "node:crypto";

const CHALLENGE_LIFETIME_SECONDS = 10 * 60;
const RESEND_AFTER_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const ENROLLMENT_LIFETIME_SECONDS = 5 * 60;

export interface RequestAccountEmailVerificationProps {
  email: string;
  platform: MobilePlatform | null;
  requestingIp: string;
}

export interface VerifyAccountEmailVerificationProps {
  challengeId: string;
  code: string;
  platform: MobilePlatform | null;
}

/** Public metadata for a newly created signup email-verification challenge. */
export interface AccountEmailVerificationChallenge {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export type VerifyAccountEmailVerificationResult =
  | { next: "login-or-recovery"; expiresAt: Date }
  | { next: "passkey-registration"; enrollmentToken: string; expiresAt: Date };

export interface IAccountEmailVerificationService {
  request(props: RequestAccountEmailVerificationProps): Promise<AccountEmailVerificationChallenge>;
  verify(props: VerifyAccountEmailVerificationProps): Promise<VerifyAccountEmailVerificationResult>;
}

export class UnavailableAccountEmailVerificationService implements IAccountEmailVerificationService {
  request(): Promise<AccountEmailVerificationChallenge> {
    throw new ServiceUnavailableError("Email verification is temporarily unavailable");
  }

  verify(): Promise<VerifyAccountEmailVerificationResult> {
    throw new ServiceUnavailableError("Email verification is temporarily unavailable");
  }
}

export class AccountEmailVerificationServiceImpl implements IAccountEmailVerificationService {
  constructor(
    private readonly challengeRepository: IEmailOtpChallengeRepository,
    private readonly codeService: IEmailOtpCodeService,
    private readonly emailSender: IEmailSender,
    private readonly enrollmentRepository: ISignupEnrollmentAuthorizationRepository,
    private readonly opaqueTokenService: IOpaqueTokenService,
    private readonly clock: IClock,
  ) {}

  async request(props: RequestAccountEmailVerificationProps): Promise<AccountEmailVerificationChallenge> {
    const email = props.email.trim().toLowerCase();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + CHALLENGE_LIFETIME_SECONDS * 1000);
    const generated = this.codeService.createChallenge("account-email-verification");
    const sessionTransport: SessionTransport = props.platform ? "bearer" : "cookie";

    await this.challengeRepository.create({
      id: generated.challengeId,
      email,
      purpose: "account-email-verification",
      codeDigest: generated.codeDigest,
      hmacFormatVersion: generated.hmacFormatVersion,
      hmacKeyVersion: generated.hmacKeyVersion,
      attemptCount: 0,
      maxAttempts: MAX_ATTEMPTS,
      sessionTransport,
      mobilePlatform: props.platform,
      requestingIp: props.requestingIp,
      expiresAt,
      createdAt,
    });

    try {
      await this.emailSender.sendAccountEmailVerificationCode({
        email,
        code: generated.code,
        expiresInMinutes: CHALLENGE_LIFETIME_SECONDS / 60,
        deliveryId: generated.challengeId,
      });
    } catch (error) {
      await this.challengeRepository.invalidate(generated.challengeId, this.clock.now());
      throw error;
    }

    return {
      challengeId: generated.challengeId,
      expiresInSeconds: CHALLENGE_LIFETIME_SECONDS,
      resendAfterSeconds: RESEND_AFTER_SECONDS,
    };
  }

  async verify(props: VerifyAccountEmailVerificationProps): Promise<VerifyAccountEmailVerificationResult> {
    const now = this.clock.now();
    const challenge = await this.challengeRepository.findById(props.challengeId);
    const sessionTransport: SessionTransport = props.platform ? "bearer" : "cookie";

    if (
      !challenge ||
      challenge.purpose !== "account-email-verification" ||
      challenge.expiresAt <= now ||
      challenge.consumedAt !== null ||
      challenge.invalidatedAt !== null ||
      challenge.attemptCount >= challenge.maxAttempts ||
      challenge.sessionTransport !== sessionTransport ||
      challenge.mobilePlatform !== props.platform
    ) {
      throw new InvalidEmailVerificationCodeError();
    }

    const codeMatches = this.codeService.verifyChallenge({
      challengeId: challenge.id,
      code: props.code,
      codeDigest: challenge.codeDigest,
      purpose: "account-email-verification",
      hmacFormatVersion: challenge.hmacFormatVersion,
      hmacKeyVersion: challenge.hmacKeyVersion,
    });
    if (!codeMatches) {
      await this.challengeRepository.recordFailedAttempt(challenge.id, now);
      throw new InvalidEmailVerificationCodeError();
    }

    const created = this.opaqueTokenService.create();
    const expiresAt = new Date(now.getTime() + ENROLLMENT_LIFETIME_SECONDS * 1000);
    const continuation = await this.enrollmentRepository.consumeAndResolveContinuation({
      challengeId: challenge.id,
      consumedAt: now,
      authorization: {
        id: randomUUID(),
        email: challenge.email,
        tokenDigest: created.digest,
        sessionTransport,
        mobilePlatform: props.platform,
        createdAt: now,
        expiresAt,
      },
    });
    if (!continuation) throw new InvalidEmailVerificationCodeError();
    if (continuation.next === "login-or-recovery") {
      return { next: "login-or-recovery", expiresAt: new Date(now.getTime() + 15 * 60 * 1000) };
    }

    return { next: "passkey-registration", enrollmentToken: created.token, expiresAt };
  }
}
