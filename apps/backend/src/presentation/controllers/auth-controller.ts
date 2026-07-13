import {
  AppPlatformHeaderValueSchema,
  LoginRequestBodySchema,
  RequestEmailOtpRequestBodySchema,
  type LoginResponse,
  type RequestEmailOtpResponse,
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
