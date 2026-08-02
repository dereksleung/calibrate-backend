import type {
  EmailOtpChallenge,
  IEmailOtpChallengeRepository,
  NewEmailOtpChallenge,
} from "@application/ports/email-otp-challenge-repository.js";
import type { IEmailSender } from "@application/ports/email-sender.js";
import type { ISignupEnrollmentAuthorizationRepository } from "@application/ports/signup-enrollment-authorization-repository.js";
import type { IAuthService } from "@application/services/auth-service.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignupEmailVerificationServiceImpl } from "@application/services/signup-email-verification-service.js";
import { UnavailableSignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import {
  RequestSignupEmailVerificationResponseSchema,
  VerifySignupEmailVerificationResponseSchema,
} from "@calibrate/api-contracts";
import express from "express";
import { createSecretKey } from "node:crypto";

import { NodeEmailOtpCodeService } from "../../../infrastructure/security/node-email-otp-code-service.js";
import { NodeOpaqueTokenService } from "../../../infrastructure/security/node-session-token-service.js";
import { AuthController } from "../../controllers/auth-controller.js";
import { createAuthRoutes } from "../auth-routes.js";

class InMemoryChallengeRepository implements IEmailOtpChallengeRepository {
  readonly created: NewEmailOtpChallenge[] = [];

  async create(challenge: NewEmailOtpChallenge): Promise<void> {
    this.created.push(challenge);
  }

  async invalidate(): Promise<void> {}

  async findById(challengeId: string): Promise<EmailOtpChallenge | null> {
    const challenge = this.created.find((item) => item.id === challengeId);
    return challenge
      ? {
          ...challenge,
          consumedAt: null,
          invalidatedAt: null,
        }
      : null;
  }

  async recordFailedAttempt(): Promise<void> {}
}

class InMemoryEnrollmentRepository implements ISignupEnrollmentAuthorizationRepository {
  readonly authorizations: unknown[] = [];

  async consumeAndCreate({
    authorization,
  }: Parameters<ISignupEnrollmentAuthorizationRepository["consumeAndCreate"]>[0]): Promise<boolean> {
    this.authorizations.push(authorization);
    return true;
  }
}

describe("signup email verification HTTP route", () => {
  const challengeRepository = new InMemoryChallengeRepository();
  const deliveredMessages: Parameters<IEmailSender["sendSignupEmailVerificationCode"]>[0][] = [];
  const emailSender: IEmailSender = {
    async sendSignupEmailVerificationCode(message) {
      deliveredMessages.push(message);
    },
    async sendPasskeyAddedNotification() {},
  };
  const authService: IAuthService = {
    login: vi.fn(),
  };
  const enrollmentRepository = new InMemoryEnrollmentRepository();
  const service = new SignupEmailVerificationServiceImpl(
    challengeRepository,
    new NodeEmailOtpCodeService({
      key: createSecretKey(Buffer.alloc(32, 7)),
      keyVersion: 2,
    }),
    emailSender,
    enrollmentRepository,
    new NodeOpaqueTokenService(),
    { now: () => new Date("2026-07-26T12:00:00.000Z") },
  );
  const unavailablePasskeyService = new UnavailableSignupPasskeyRegistrationService();
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createAuthRoutes(new AuthController(authService, service, unavailablePasskeyService)));
  let server: Server;
  let baseUrl: string;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  it("accepts a web signup email and delivers one code without exposing it", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/email-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "  Person@Example.COM " }),
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = RequestSignupEmailVerificationResponseSchema.parse(await response.json());
    expect(body).toEqual({
      challengeId: expect.any(String),
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("user");
    expect(body).not.toHaveProperty("accessToken");

    expect(challengeRepository.created).toHaveLength(1);
    expect(challengeRepository.created[0]).toMatchObject({
      email: "person@example.com",
      purpose: "signup-email-verification",
      hmacFormatVersion: 2,
      sessionTransport: "cookie",
      mobilePlatform: null,
    });
    expect(challengeRepository.created[0]?.requestingIp).toBeTruthy();
    expect(deliveredMessages).toEqual([
      {
        email: "person@example.com",
        code: expect.stringMatching(/^\d{6}$/),
        expiresInMinutes: 10,
        deliveryId: body.challengeId,
      },
    ]);
  });

  it("verifies a delivered OTP and sends the enrollment authorization only as a cookie", async () => {
    const requestResponse = await fetch(`${baseUrl}/api/v1/auth/email-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "verify@example.com" }),
    });
    const requestBody = RequestSignupEmailVerificationResponseSchema.parse(await requestResponse.json());
    const code = deliveredMessages[deliveredMessages.length - 1]?.code;

    const response = await fetch(`${baseUrl}/api/v1/auth/email-verification/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: requestBody.challengeId, code }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/passkey-enrollment=[^;]+/);
    expect(cookie).toContain("Max-Age=300");
    expect(cookie).toContain("Path=/api/v1/auth/passkeys/registration");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const body = VerifySignupEmailVerificationResponseSchema.parse(await response.json());
    expect(body).toEqual({ next: "passkey-registration", expiresAt: "2026-07-26T12:05:00.000Z" });
    expect(JSON.stringify(body)).not.toContain("token");
    expect(enrollmentRepository.authorizations).toEqual([
      expect.objectContaining({ email: "verify@example.com", tokenDigest: expect.any(String) }),
    ]);
  });

  it.each(["/api/v1/auth/email-otp", "/api/v1/auth/email-otp/verify"])(
    "does not expose retired route %s",
    async (path) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "person@example.com" }),
      });

      expect(response.status).toBe(404);
    },
  );
});
