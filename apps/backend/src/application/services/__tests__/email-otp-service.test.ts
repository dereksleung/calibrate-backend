import { IClock, IEmailOtpChallengeRepository, IEmailOtpCodeService, IEmailSender } from "@application";
import { EmailOtpServiceImpl } from "@services";
import { MockedObject, vi } from "vitest";

describe("EmailOtpServiceImpl", () => {
  let challengeRepository: MockedObject<IEmailOtpChallengeRepository>;
  let codeService: MockedObject<IEmailOtpCodeService>;
  let emailSender: MockedObject<IEmailSender>;
  let service: EmailOtpServiceImpl;

  const now = new Date("2026-07-12T12:00:00.000Z");
  const clock: IClock = { now: () => now };

  beforeEach(() => {
    challengeRepository = { create: vi.fn(), invalidate: vi.fn() };
    codeService = { createChallenge: vi.fn() };
    emailSender = { sendAuthenticationCode: vi.fn() };
    service = new EmailOtpServiceImpl(challengeRepository, codeService, emailSender, clock);
  });

  it("normalizes the email, persists a web challenge, and delivers its code", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "012345",
      codeDigest: "digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
    });
    challengeRepository.create.mockResolvedValue(undefined);

    const result = await service.request({
      email: "  Person@Example.COM ",
      platform: null,
      requestingIp: "203.0.113.4",
    });

    expect(challengeRepository.create).toHaveBeenCalledWith({
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "authentication",
      codeDigest: "digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "cookie",
      mobilePlatform: null,
      requestingIp: "203.0.113.4",
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      createdAt: now,
    });
    expect(emailSender.sendAuthenticationCode).toHaveBeenCalledWith({
      email: "person@example.com",
      code: "012345",
      expiresInMinutes: 10,
    });
    expect(result).toEqual({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it("binds a declared mobile platform to bearer transport", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
    });
    challengeRepository.create.mockResolvedValue(undefined);

    await service.request({
      email: "person@example.com",
      platform: "ios",
      requestingIp: null,
    });

    expect(challengeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionTransport: "bearer", mobilePlatform: "ios" }),
    );
  });

  it("does not deliver a code when persistence rejects the request", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
    });
    challengeRepository.create.mockRejectedValue(new Error("OTP request limit exceeded"));

    await expect(
      service.request({ email: "person@example.com", platform: null, requestingIp: null }),
    ).rejects.toThrow("OTP request limit exceeded");
    expect(emailSender.sendAuthenticationCode).not.toHaveBeenCalled();
  });

  it("invalidates the persisted challenge when delivery fails", async () => {
    codeService.createChallenge.mockReturnValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      codeDigest: "digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
    });
    challengeRepository.create.mockResolvedValue(undefined);
    emailSender.sendAuthenticationCode.mockRejectedValue(new Error("delivery failed"));

    await expect(
      service.request({ email: "person@example.com", platform: null, requestingIp: null }),
    ).rejects.toThrow("delivery failed");

    expect(challengeRepository.invalidate).toHaveBeenCalledWith("d9428888-122b-4e2b-9c24-2dc8442eaa31", now);
  });
});
