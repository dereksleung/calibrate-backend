import type {
  EmailOtpChallenge,
  IAuthService,
  IEmailOtpChallengeRepository,
  IEmailSender,
  NewEmailOtpChallenge,
} from "@application";
import { RequestSignupEmailVerificationResponseSchema } from "@calibrate/api-contracts";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignupEmailVerificationServiceImpl } from "@services";
import express from "express";
import { createSecretKey } from "node:crypto";

import { NodeEmailOtpCodeService } from "../../../infrastructure/security/node-email-otp-code-service.js";
import { AuthController } from "../../controllers/auth-controller.js";
import { createAuthRoutes } from "../auth-routes.js";

class InMemoryChallengeRepository implements IEmailOtpChallengeRepository {
  readonly created: NewEmailOtpChallenge[] = [];

  async create(challenge: NewEmailOtpChallenge): Promise<void> {
    this.created.push(challenge);
  }

  async invalidate(): Promise<void> {}

  async findById(): Promise<EmailOtpChallenge | null> {
    return null;
  }

  async recordFailedAttempt(): Promise<void> {}
}

describe("signup email verification HTTP route", () => {
  const challengeRepository = new InMemoryChallengeRepository();
  const deliveredMessages: Parameters<IEmailSender["sendSignupEmailVerificationCode"]>[0][] = [];
  const emailSender: IEmailSender = {
    async sendSignupEmailVerificationCode(message) {
      deliveredMessages.push(message);
    },
  };
  const authService: IAuthService = {
    login: vi.fn(),
  };
  const service = new SignupEmailVerificationServiceImpl(
    challengeRepository,
    new NodeEmailOtpCodeService({
      key: createSecretKey(Buffer.alloc(32, 7)),
      keyVersion: 2,
    }),
    emailSender,
    { now: () => new Date("2026-07-26T12:00:00.000Z") },
  );
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createAuthRoutes(new AuthController(authService, service)));
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
