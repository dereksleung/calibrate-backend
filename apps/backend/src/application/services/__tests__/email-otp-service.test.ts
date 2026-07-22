import {
  AuthenticationError,
  IClock,
  IEmailOtpChallengeRepository,
  IEmailOtpCodeService,
  IEmailSender,
  ISessionTokenService,
} from "@application";
import { User } from "@domain";
import { EmailOtpServiceImpl } from "@services";
import { MockedObject, vi } from "vitest";

describe("EmailOtpServiceImpl", () => {
  let challengeRepository: MockedObject<IEmailOtpChallengeRepository>;
  let codeService: MockedObject<IEmailOtpCodeService>;
  let emailSender: MockedObject<IEmailSender>;
  let sessionTokenService: MockedObject<ISessionTokenService>;
  let service: EmailOtpServiceImpl;

  const now = new Date("2026-07-12T12:00:00.000Z");
  const clock: IClock = { now: () => now };

  beforeEach(() => {
    challengeRepository = {
      create: vi.fn(),
      invalidate: vi.fn(),
      findById: vi.fn(),
      recordFailedAttempt: vi.fn(),
      consumeAndCreateSession: vi.fn(),
    };
    codeService = { createChallenge: vi.fn(), verifyChallenge: vi.fn() };
    emailSender = { sendAuthenticationCode: vi.fn() };
    sessionTokenService = { create: vi.fn() };
    service = new EmailOtpServiceImpl(
      challengeRepository,
      codeService,
      emailSender,
      clock,
      sessionTokenService,
    );
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
      deliveryId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
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

  it("verifies a web challenge and creates a bounded server session", async () => {
    const challenge = {
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "authentication" as const,
      codeDigest: "stored-digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 3,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "cookie" as const,
      mobilePlatform: null,
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      consumedAt: null,
      invalidatedAt: null,
    };
    const verifiedUser = User.reconstitute({
      id: "5bc622a4-4aa7-445d-989d-364a15d9a6a8",
      email: "person@example.com",
      passwordHash: null,
      emailVerifiedAt: now,
      tier: "FREE",
      createdAt: now,
      updatedAt: now,
    });
    challengeRepository.findById.mockResolvedValue(challenge);
    codeService.verifyChallenge.mockReturnValue(true);
    sessionTokenService.create.mockReturnValue({ token: "raw-session-token", digest: "session-digest" });
    challengeRepository.consumeAndCreateSession.mockResolvedValue(verifiedUser);

    const result = await service.verify({
      challengeId: challenge.id,
      code: "123456",
      platform: null,
    });

    expect(challengeRepository.consumeAndCreateSession).toHaveBeenCalledWith({
      challengeId: challenge.id,
      verifiedAt: now,
      session: {
        tokenDigest: "session-digest",
        transport: "cookie",
        mobilePlatform: null,
        createdAt: now,
        lastSeenAt: now,
        inactivityExpiresAt: new Date("2026-08-11T12:00:00.000Z"),
        absoluteExpiresAt: new Date("2027-01-08T12:00:00.000Z"),
      },
    });
    expect(result).toEqual({
      user: verifiedUser,
      sessionToken: "raw-session-token",
      sessionTransport: "cookie",
      expiresAt: new Date("2026-08-11T12:00:00.000Z"),
    });
  });

  it.each([
    ["unknown", null],
    ["expired", { expiresAt: new Date("2026-07-12T11:59:59.999Z") }],
    ["invalidated", { invalidatedAt: now }],
    ["consumed", { consumedAt: now }],
    ["exhausted", { attemptCount: 5 }],
  ])("returns the generic error for an %s challenge", async (_case, override) => {
    challengeRepository.findById.mockResolvedValue(
      override
        ? {
            id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
            email: "person@example.com",
            purpose: "authentication",
            codeDigest: "stored-digest",
            hmacFormatVersion: 1,
            hmacKeyVersion: 1,
            attemptCount: 0,
            maxAttempts: 5,
            sessionTransport: "cookie",
            mobilePlatform: null,
            expiresAt: new Date("2026-07-12T12:10:00.000Z"),
            consumedAt: null,
            invalidatedAt: null,
            ...override,
          }
        : null,
    );

    await expect(
      service.verify({
        challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
        code: "123456",
        platform: null,
      }),
    ).rejects.toEqual(new AuthenticationError("Invalid or expired code"));
  });

  it.each([
    ["wrong code", null, false],
    ["mismatched transport", "ios" as const, true],
  ])("increments the attempt atomically for a %s", async (_case, platform, codeMatches) => {
    challengeRepository.findById.mockResolvedValue({
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "authentication",
      codeDigest: "stored-digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "cookie",
      mobilePlatform: null,
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      consumedAt: null,
      invalidatedAt: null,
    });
    codeService.verifyChallenge.mockReturnValue(codeMatches);

    await expect(
      service.verify({
        challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
        code: "000000",
        platform,
      }),
    ).rejects.toEqual(new AuthenticationError("Invalid or expired code"));

    expect(challengeRepository.recordFailedAttempt).toHaveBeenCalledWith(
      "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      now,
    );
    expect(challengeRepository.consumeAndCreateSession).not.toHaveBeenCalled();
  });

  it("returns the generic error when another verifier consumes the challenge first", async () => {
    challengeRepository.findById.mockResolvedValue({
      id: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      email: "person@example.com",
      purpose: "authentication",
      codeDigest: "stored-digest",
      hmacFormatVersion: 1,
      hmacKeyVersion: 1,
      attemptCount: 0,
      maxAttempts: 5,
      sessionTransport: "bearer",
      mobilePlatform: "android",
      expiresAt: new Date("2026-07-12T12:10:00.000Z"),
      consumedAt: null,
      invalidatedAt: null,
    });
    codeService.verifyChallenge.mockReturnValue(true);
    sessionTokenService.create.mockReturnValue({ token: "raw-session-token", digest: "session-digest" });
    challengeRepository.consumeAndCreateSession.mockResolvedValue(null);

    await expect(
      service.verify({
        challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
        code: "123456",
        platform: "android",
      }),
    ).rejects.toEqual(new AuthenticationError("Invalid or expired code"));
  });
});
