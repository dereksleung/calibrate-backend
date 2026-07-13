import type {
  AppPlatformHeaderValue,
  RequestEmailOtpResponse,
  SessionTransport,
} from "@calibrate/api-contracts";

import {
  AuthenticationError,
  IClock,
  IEmailOtpChallengeRepository,
  IEmailOtpCodeService,
  IEmailSender,
  ISessionTokenService,
  ServiceUnavailableError,
} from "@application";

const CHALLENGE_LIFETIME_SECONDS = 10 * 60;
const RESEND_AFTER_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const INACTIVITY_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const ABSOLUTE_LIFETIME_MILLISECONDS = 180 * 24 * 60 * 60 * 1000;
const INVALID_CODE_MESSAGE = "Invalid or expired code";

export interface RequestEmailOtpProps {
  email: string;
  platform: AppPlatformHeaderValue | null;
  requestingIp: string | null;
}

export interface VerifyEmailOtpProps {
  challengeId: string;
  code: string;
  platform: AppPlatformHeaderValue | null;
}

export interface VerifiedEmailOtpResult {
  user: import("@domain").User;
  sessionTransport: SessionTransport;
  sessionToken: string;
  expiresAt: Date;
}

export interface IEmailOtpService {
  request(props: RequestEmailOtpProps): Promise<RequestEmailOtpResponse>;
  verify(props: VerifyEmailOtpProps): Promise<VerifiedEmailOtpResult>;
}

export class UnavailableEmailOtpService implements IEmailOtpService {
  request(): Promise<RequestEmailOtpResponse> {
    throw new ServiceUnavailableError("Email authentication is temporarily unavailable");
  }

  verify(): Promise<VerifiedEmailOtpResult> {
    throw new ServiceUnavailableError("Email authentication is temporarily unavailable");
  }
}

export class EmailOtpServiceImpl implements IEmailOtpService {
  constructor(
    private readonly challengeRepository: IEmailOtpChallengeRepository,
    private readonly codeService: IEmailOtpCodeService,
    private readonly emailSender: IEmailSender,
    private readonly clock: IClock,
    private readonly sessionTokenService: ISessionTokenService,
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

  async verify(props: VerifyEmailOtpProps): Promise<VerifiedEmailOtpResult> {
    const challenge = await this.challengeRepository.findById(props.challengeId);
    const now = this.clock.now();

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.invalidatedAt ||
      challenge.attemptCount >= challenge.maxAttempts ||
      challenge.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationError(INVALID_CODE_MESSAGE);
    }

    const expectedTransport: SessionTransport = props.platform ? "bearer" : "cookie";
    const transportMatches =
      challenge.sessionTransport === expectedTransport && challenge.mobilePlatform === props.platform;
    const codeMatches = this.codeService.verifyChallenge({
      challengeId: challenge.id,
      code: props.code,
      codeDigest: challenge.codeDigest,
      purpose: challenge.purpose,
      hmacFormatVersion: challenge.hmacFormatVersion,
      hmacKeyVersion: challenge.hmacKeyVersion,
    });

    if (!transportMatches || !codeMatches) {
      await this.challengeRepository.recordFailedAttempt(challenge.id, now);
      throw new AuthenticationError(INVALID_CODE_MESSAGE);
    }

    const sessionToken = this.sessionTokenService.create();
    const inactivityExpiresAt = new Date(now.getTime() + INACTIVITY_LIFETIME_MILLISECONDS);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MILLISECONDS);
    const user = await this.challengeRepository.consumeAndCreateSession({
      challengeId: challenge.id,
      verifiedAt: now,
      session: {
        tokenDigest: sessionToken.digest,
        transport: challenge.sessionTransport,
        mobilePlatform: challenge.mobilePlatform,
        createdAt: now,
        lastSeenAt: now,
        inactivityExpiresAt,
        absoluteExpiresAt,
      },
    });

    if (!user) {
      throw new AuthenticationError(INVALID_CODE_MESSAGE);
    }

    return {
      user,
      sessionTransport: challenge.sessionTransport,
      sessionToken: sessionToken.token,
      expiresAt: inactivityExpiresAt,
    };
  }
}
