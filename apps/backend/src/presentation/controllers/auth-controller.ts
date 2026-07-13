import {
  AppPlatformHeaderValueSchema,
  LoginRequestBodySchema,
  RequestEmailOtpRequestBodySchema,
  VerifyEmailOtpRequestBodySchema,
  type LoginResponse,
  type RequestEmailOtpResponse,
  type VerifyEmailOtpResponse,
} from "@calibrate/api-contracts";
import { handleControllerError } from "@common";
import { IAuthService, IEmailOtpService } from "@services";
import { validate } from "@validation";
import { Request, Response } from "express";

import { UserResponseMapper } from "../mappers/user-response-mapper.js";

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly emailOtpService: IEmailOtpService,
    private readonly emailOtpConfig: {
      webOrigin: string;
      sessionCookie: { name: string; secure: boolean };
    },
  ) {}

  async requestEmailOtp(req: Request, res: Response): Promise<void> {
    const validatedBody = validate(RequestEmailOtpRequestBodySchema, req.body);
    const platformHeader = req.get("X-App-Platform");
    const validatedPlatform = platformHeader
      ? AppPlatformHeaderValueSchema.safeParse(platformHeader)
      : { success: true as const, data: null };

    if (!validatedBody.isValid || !validatedPlatform.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }

    try {
      const response: RequestEmailOtpResponse = await this.emailOtpService.request({
        email: validatedBody.data.email,
        platform: validatedPlatform.data,
        requestingIp: req.ip ?? null,
      });
      res.status(202).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  async verifyEmailOtp(req: Request, res: Response): Promise<void> {
    const validatedBody = validate(VerifyEmailOtpRequestBodySchema, req.body);
    const platformHeader = req.get("X-App-Platform");
    const validatedPlatform = platformHeader
      ? AppPlatformHeaderValueSchema.safeParse(platformHeader)
      : { success: true as const, data: null };

    if (!validatedBody.isValid || !validatedPlatform.success) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }

    if (validatedPlatform.data === null && req.get("Origin") !== this.emailOtpConfig.webOrigin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const result = await this.emailOtpService.verify({
        challengeId: validatedBody.data.challengeId,
        code: validatedBody.data.code,
        platform: validatedPlatform.data,
      });

      const user = UserResponseMapper.toResponse(result.user);
      let response: VerifyEmailOtpResponse;
      if (result.sessionTransport === "cookie") {
        res.cookie(this.emailOtpConfig.sessionCookie.name, result.sessionToken, {
          httpOnly: true,
          secure: this.emailOtpConfig.sessionCookie.secure,
          sameSite: "lax",
          path: "/",
          expires: result.expiresAt,
        });
        response = { sessionTransport: "cookie", user };
      } else {
        response = {
          sessionTransport: "bearer",
          user,
          sessionToken: result.sessionToken,
          expiresAt: result.expiresAt.toISOString(),
        };
      }

      res.set("Cache-Control", "no-store");
      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
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
