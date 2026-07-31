import {
  IClock,
  IEmailOtpChallengeRepository,
  IEmailOtpCodeService,
  IEmailSender,
  IOpaqueTokenService,
  ISignupEnrollmentAuthorizationRepository,
} from "@application";
import { SignupEmailVerificationServiceImpl } from "@services";
import { MockedObject, vi } from "vitest";

describe("SignupEmailVerificationServiceImpl", () => {
  let challengeRepository: MockedObject<IEmailOtpChallengeRepository>;
  let codeService: MockedObject<IEmailOtpCodeService>;
  let emailSender: MockedObject<IEmailSender>;
  let enrollmentRepository: MockedObject<ISignupEnrollmentAuthorizationRepository>;
  let opaqueTokenService: MockedObject<IOpaqueTokenService>;
  let service: SignupEmailVerificationServiceImpl;

  const now = new Date("2026-07-12T12:00:00.000Z");
  const clock: IClock = { now: () => now };

  beforeEach(() => {
    challengeRepository = {
      create: vi.fn(),
      invalidate: vi.fn(),
      findById: vi.fn(),
      recordFailedAttempt: vi.fn(),
    };
    codeService = { createChallenge: vi.fn(), verifyChallenge: vi.fn() };
    emailSender = { sendSignupEmailVerificationCode: vi.fn() };
    enrollmentRepository = { consumeAndCreate: vi.fn() };
    opaqueTokenService = { create: vi.fn() };
    service = new SignupEmailVerificationServiceImpl(
      challengeRepository,
      codeService,
      emailSender,
      enrollmentRepository,
      opaqueTokenService,
      clock,
    );
  });

  it("consumes a correctly bound challenge and creates a five-minute enrollment authorization", async () => {
    const challenge = {
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "signup-email-verification" as const,
      codeDigest: "code-digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "cookie" as const,
      mobilePlatform: null,
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      consumedAt: null,
      invalidatedAt: null,
    };
    challengeRepository.findById.mockResolvedValue(challenge);
    codeService.verifyChallenge.mockReturnValue(true);
    opaqueTokenService.create.mockReturnValue({ token: "raw-enrollment-token", digest: "token-digest" });
    enrollmentRepository.consumeAndCreate.mockResolvedValue(true);

    const result = await service.verify({
      challengeId: challenge.id,
      code: "012345",
      platform: null,
    });

    expect(codeService.verifyChallenge).toHaveBeenCalledWith({
      challengeId: challenge.id,
      code: "012345",
      codeDigest: "code-digest",
      purpose: "signup-email-verification",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
    });
    expect(enrollmentRepository.consumeAndCreate).toHaveBeenCalledWith({
      challengeId: challenge.id,
      consumedAt: now,
      authorization: expect.objectContaining({
        email: "person@example.com",
        tokenDigest: "token-digest",
        sessionTransport: "cookie",
        mobilePlatform: null,
        createdAt: now,
        expiresAt: new Date("2026-07-12T12:05:00.000Z"),
      }),
    });
    expect(result).toEqual({
      enrollmentToken: "raw-enrollment-token",
      expiresAt: new Date("2026-07-12T12:05:00.000Z"),
    });
  });

  it("rejects a mismatched client binding without checking the code or consuming an OTP attempt", async () => {
    challengeRepository.findById.mockResolvedValue({
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "signup-email-verification",
      codeDigest: "code-digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "bearer",
      mobilePlatform: "ios",
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      consumedAt: null,
      invalidatedAt: null,
    });

    await expect(
      service.verify({
        challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
        code: "012345",
        platform: null,
      }),
    ).rejects.toThrow("Invalid or expired verification code");
    expect(codeService.verifyChallenge).not.toHaveBeenCalled();
    expect(challengeRepository.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it("persists and delivers a normalized web signup-email challenge", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "012345",
      codeDigest: "digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
    });

    const result = await service.request({
      email: "  Person@Example.COM ",
      platform: null,
      requestingIp: "203.0.113.4",
    });

    expect(codeService.createChallenge).toHaveBeenCalledWith("signup-email-verification");
    expect(challengeRepository.create).toHaveBeenCalledWith({
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "signup-email-verification",
      codeDigest: "digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "cookie",
      mobilePlatform: null,
      requestingIp: "203.0.113.4",
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      createdAt: now,
    });
    expect(emailSender.sendSignupEmailVerificationCode).toHaveBeenCalledWith({
      email: "person@example.com",
      code: "012345",
      expiresInMinutes: 10,
      deliveryId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
    });
    expect(result).toEqual({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it.each(["ios", "android"] as const)("binds %s signup to bearer transport", async (platform) => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
    });

    await service.request({
      email: "person@example.com",
      platform,
      requestingIp: "203.0.113.4",
    });

    expect(challengeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionTransport: "bearer", mobilePlatform: platform }),
    );
  });

  it("does not deliver when persistence rejects the request", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
    });
    challengeRepository.create.mockRejectedValue(new Error("Too many verification-code requests"));

    await expect(
      service.request({
        email: "person@example.com",
        platform: null,
        requestingIp: "203.0.113.4",
      }),
    ).rejects.toThrow("Too many verification-code requests");
    expect(emailSender.sendSignupEmailVerificationCode).not.toHaveBeenCalled();
  });

  it("invalidates a persisted challenge when delivery fails", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 2,
      hmacKeyVersion: 1,
    });
    emailSender.sendSignupEmailVerificationCode.mockRejectedValue(new Error("delivery failed"));

    await expect(
      service.request({
        email: "person@example.com",
        platform: null,
        requestingIp: "203.0.113.4",
      }),
    ).rejects.toThrow("delivery failed");

    expect(challengeRepository.invalidate).toHaveBeenCalledWith("d9428888-122b-4e2b-9c24-2dc8442eaa31", now);
  });
});
