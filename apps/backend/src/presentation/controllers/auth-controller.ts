import { InvalidEmailVerificationCodeError } from "@application/errors/invalid-email-verification-code-error.js";
import { RateLimitError } from "@application/errors/rate-limit-error.js";
import { ServiceUnavailableError } from "@application/errors/service-unavailable-error.js";
import { IAuthService } from "@application/services/auth-service.js";
import { ISignupEmailVerificationService } from "@application/services/signup-email-verification-service.js";
import {
  AppPlatformHeaderValueSchema,
  LoginRequestBodySchema,
  RequestSignupEmailVerificationRequestBodySchema,
  VerifySignupEmailVerificationRequestBodySchema,
  type LoginResponse,
  type RequestSignupEmailVerificationResponse,
  type VerifySignupEmailVerificationResponse,
} from "@calibrate/api-contracts";
import { handleControllerError } from "@common/errors/controller-error-handler.js";
import { validate } from "@validation/validation-helpers.js";
import { Request, Response } from "express";

import { getEnrollmentCookieConfiguration } from "../auth/enrollment-cookie.js";
import { UserResponseMapper } from "../mappers/user-response-mapper.js";

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly signupEmailVerificationService: ISignupEmailVerificationService,
  ) {}

  async requestSignupEmailVerification(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const validatedBody = validate(RequestSignupEmailVerificationRequestBodySchema, req.body);
    const platformHeader = req.get("X-App-Platform");
    const validatedPlatform = platformHeader
      ? AppPlatformHeaderValueSchema.safeParse(platformHeader)
      : { success: true as const, data: null }; // web origin does not send this header

    if (!validatedBody.isValid || !validatedPlatform.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }

    if (!req.ip) {
      res.status(503).json({
        error: "Email verification is temporarily unavailable",
      });
      return;
    }

    try {
      const response: RequestSignupEmailVerificationResponse =
        await this.signupEmailVerificationService.request({
          email: validatedBody.data.email,
          platform: validatedPlatform.data,
          requestingIp: req.ip,
        });
      res.status(202).json(response);
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({ error: "Too many verification-code requests" });
        return;
      }
      if (error instanceof ServiceUnavailableError) {
        res.status(503).json({
          error: "Email verification is temporarily unavailable",
        });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async verifySignupEmailVerification(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const validatedBody = validate(VerifySignupEmailVerificationRequestBodySchema, req.body);
    const platformHeader = req.get("X-App-Platform");
    const validatedPlatform = platformHeader
      ? AppPlatformHeaderValueSchema.safeParse(platformHeader)
      : { success: true as const, data: null };

    if (!validatedBody.isValid || !validatedPlatform.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }

    // Native credential delivery is intentionally deferred; never create a credential
    // that cannot be delivered without exposing it in the response body.
    if (validatedPlatform.data !== null) {
      res.status(501).json({ error: "Passkey enrollment is not available for this client" });
      return;
    }

    try {
      const result = await this.signupEmailVerificationService.verify({
        challengeId: validatedBody.data.challengeId,
        code: validatedBody.data.code,
        platform: validatedPlatform.data,
      });

      const cookie = getEnrollmentCookieConfiguration();
      res.cookie(cookie.name, result.enrollmentToken, cookie.options);
      const response: VerifySignupEmailVerificationResponse = {
        next: "passkey-registration",
        expiresAt: result.expiresAt.toISOString(),
      };
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof InvalidEmailVerificationCodeError) {
        res.status(400).json({ error: "Invalid or expired verification code" });
        return;
      }
      if (error instanceof ServiceUnavailableError) {
        res.status(503).json({ error: "Email verification is temporarily unavailable" });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedInput = validate(LoginRequestBodySchema, req.body);
      if (!validatedInput.isValid) {
        res.status(400).json({
          error: "Validation failed",
          details: validatedInput.errors,
        });
        return;
      }

      const loginResult = await this.authService.login(validatedInput.data);
      const response: LoginResponse = {
        accessToken: loginResult.accessToken,
        tokenType: "Bearer",
        expiresIn: loginResult.expiresInSeconds,
        user: UserResponseMapper.toResponse(loginResult.user),
      };

      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}
