import type {
  AppPlatformHeaderValue,
  RequestSignupEmailVerificationResponse,
  SessionTransport,
} from "@calibrate/api-contracts";

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

export interface RequestSignupEmailVerificationProps {
  email: string;
  platform: AppPlatformHeaderValue | null;
  requestingIp: string;
}

export interface VerifySignupEmailVerificationProps {
  challengeId: string;
  code: string;
  platform: AppPlatformHeaderValue | null;
}

export interface VerifySignupEmailVerificationResult {
  enrollmentToken: string;
  expiresAt: Date;
}

export interface ISignupEmailVerificationService {
  request(props: RequestSignupEmailVerificationProps): Promise<RequestSignupEmailVerificationResponse>;
  verify(props: VerifySignupEmailVerificationProps): Promise<VerifySignupEmailVerificationResult>;
}

export class UnavailableSignupEmailVerificationService implements ISignupEmailVerificationService {
  request(): Promise<RequestSignupEmailVerificationResponse> {
    throw new ServiceUnavailableError("Email verification is temporarily unavailable");
  }

  verify(): Promise<VerifySignupEmailVerificationResult> {
    throw new ServiceUnavailableError("Email verification is temporarily unavailable");
  }
}

export class SignupEmailVerificationServiceImpl implements ISignupEmailVerificationService {
  constructor(
    private readonly challengeRepository: IEmailOtpChallengeRepository,
    private readonly codeService: IEmailOtpCodeService,
    private readonly emailSender: IEmailSender,
    private readonly enrollmentRepository: ISignupEnrollmentAuthorizationRepository,
    private readonly opaqueTokenService: IOpaqueTokenService,
    private readonly clock: IClock,
  ) {}

  async request(props: RequestSignupEmailVerificationProps): Promise<RequestSignupEmailVerificationResponse> {
    const email = props.email.trim().toLowerCase();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + CHALLENGE_LIFETIME_SECONDS * 1000);
    const generated = this.codeService.createChallenge("signup-email-verification");
    const sessionTransport: SessionTransport = props.platform ? "bearer" : "cookie";

    await this.challengeRepository.create({
      id: generated.challengeId,
      email,
      purpose: "signup-email-verification",
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
      await this.emailSender.sendSignupEmailVerificationCode({
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

  async verify(props: VerifySignupEmailVerificationProps): Promise<VerifySignupEmailVerificationResult> {
    const now = this.clock.now();
    const challenge = await this.challengeRepository.findById(props.challengeId);
    const sessionTransport: SessionTransport = props.platform ? "bearer" : "cookie";

    if (
      !challenge ||
      challenge.purpose !== "signup-email-verification" ||
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
      purpose: "signup-email-verification",
      hmacFormatVersion: challenge.hmacFormatVersion,
      hmacKeyVersion: challenge.hmacKeyVersion,
    });
    if (!codeMatches) {
      await this.challengeRepository.recordFailedAttempt(challenge.id, now);
      throw new InvalidEmailVerificationCodeError();
    }

    const created = this.opaqueTokenService.create();
    const expiresAt = new Date(now.getTime() + ENROLLMENT_LIFETIME_SECONDS * 1000);
    const consumed = await this.enrollmentRepository.consumeAndCreate({
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
    if (!consumed) throw new InvalidEmailVerificationCodeError();

    return { enrollmentToken: created.token, expiresAt };
  }
}
