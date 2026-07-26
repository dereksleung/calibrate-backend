import type {
  AppPlatformHeaderValue,
  RequestSignupEmailVerificationResponse,
  SessionTransport,
} from "@calibrate/api-contracts";

import {
  IClock,
  IEmailOtpChallengeRepository,
  IEmailOtpCodeService,
  IEmailSender,
  ServiceUnavailableError,
} from "@application";

const CHALLENGE_LIFETIME_SECONDS = 10 * 60;
const RESEND_AFTER_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export interface RequestSignupEmailVerificationProps {
  email: string;
  platform: AppPlatformHeaderValue | null;
  requestingIp: string;
}

export interface ISignupEmailVerificationService {
  request(props: RequestSignupEmailVerificationProps): Promise<RequestSignupEmailVerificationResponse>;
}

export class UnavailableSignupEmailVerificationService implements ISignupEmailVerificationService {
  request(): Promise<RequestSignupEmailVerificationResponse> {
    throw new ServiceUnavailableError("Email verification is temporarily unavailable");
  }
}

export class SignupEmailVerificationServiceImpl implements ISignupEmailVerificationService {
  constructor(
    private readonly challengeRepository: IEmailOtpChallengeRepository,
    private readonly codeService: IEmailOtpCodeService,
    private readonly emailSender: IEmailSender,
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
}
