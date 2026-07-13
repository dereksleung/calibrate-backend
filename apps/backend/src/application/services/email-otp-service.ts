import type {
  AppPlatformHeaderValue,
  RequestEmailOtpResponse,
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

export interface RequestEmailOtpProps {
  email: string;
  platform: AppPlatformHeaderValue | null;
  requestingIp: string | null;
}

export interface IEmailOtpService {
  request(props: RequestEmailOtpProps): Promise<RequestEmailOtpResponse>;
}

export class UnavailableEmailOtpService implements IEmailOtpService {
  request(): Promise<RequestEmailOtpResponse> {
    throw new ServiceUnavailableError("Email authentication is temporarily unavailable");
  }
}

export class EmailOtpServiceImpl implements IEmailOtpService {
  constructor(
    private readonly challengeRepository: IEmailOtpChallengeRepository,
    private readonly codeService: IEmailOtpCodeService,
    private readonly emailSender: IEmailSender,
    private readonly clock: IClock,
  ) {}

  async request(props: RequestEmailOtpProps): Promise<RequestEmailOtpResponse> {
    const email = props.email.trim().toLowerCase();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + CHALLENGE_LIFETIME_SECONDS * 1000);
    const generated = this.codeService.createChallenge("authentication");
    const sessionTransport: SessionTransport = props.platform ? "bearer" : "cookie";

    await this.challengeRepository.create({
      id: generated.challengeId,
      email,
      purpose: "authentication",
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
      await this.emailSender.sendAuthenticationCode({
        email,
        code: generated.code,
        expiresInMinutes: CHALLENGE_LIFETIME_SECONDS / 60,
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
