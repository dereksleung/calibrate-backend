import { InvalidEmailVerificationCodeError } from "@application/errors/invalid-email-verification-code-error.js";
import {
  PasskeyAuthenticationFailedError,
  PasskeyAuthenticationRateLimitedError,
  PasskeyAuthenticationStateConflictError,
  PasskeyAuthenticationUnavailableError,
} from "@application/errors/passkey-authentication-errors.js";
import {
  EnrollmentAuthorizationRequiredError,
  OriginNotAllowedError,
  PasskeyRegistrationFailedError,
  PasskeyRegistrationRateLimitedError,
  PasskeyRegistrationStateConflictError,
  PasskeyRegistrationUnavailableError,
} from "@application/errors/passkey-registration-errors.js";
import { RateLimitError } from "@application/errors/rate-limit-error.js";
import { ServiceUnavailableError } from "@application/errors/service-unavailable-error.js";
import { IAccountEmailVerificationService } from "@application/services/account-email-verification-service.js";
import { IAuthService } from "@application/services/auth-service.js";
import {
  IPasskeyAuthenticationService,
  UnavailablePasskeyAuthenticationService,
} from "@application/services/passkey-authentication-service.js";
import { ISessionRestorationService } from "@application/services/session-restoration-service.js";
import { ISignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import { IRecoveryRegistrationAuthorizationService } from "@application/services/recovery-registration-authorization-service.js";
import { IRecoveryPasskeyRegistrationService } from "@application/services/recovery-passkey-registration-service.js";
import {
  AppPlatformHeaderValueSchema,
  AuthorizeRecoveryRegistrationRequestBodySchema,
  AuthenticatedSessionResponse,
  LoginRequestBodySchema,
  PasskeyRegistrationErrorResponse,
  RequestAccountEmailVerificationRequestBodySchema,
  VerifyPasskeyAuthenticationRequestBodySchema,
  VerifyPasskeyRegistrationRequestBodySchema,
  VerifyAccountEmailVerificationRequestBodySchema,
  type LoginResponse,
  type RequestAccountEmailVerificationResponse,
  type VerifyAccountEmailVerificationResponse,
  type AuthorizeRecoveryRegistrationResponse,
} from "@calibrate/api-contracts";
import { handleControllerError } from "@common/errors/controller-error-handler.js";
import { validate } from "@validation/validation-helpers.js";
import { Request, Response } from "express";

import { getAccessCookieConfiguration, getAccessCookieMaxAgeMs } from "../auth/access-cookie.js";
import { getAccountAccessCookieConfiguration } from "../auth/account-access-cookie.js";
import { extractCookieValue } from "../auth/cookie-extractor.js";
import { getEnrollmentCookieConfiguration } from "../auth/enrollment-cookie.js";
import { getRefreshCookieConfiguration, getRefreshCookieMaxAgeMs } from "../auth/refresh-cookie.js";
import { getRecoveryRegistrationCookieConfiguration } from "../auth/recovery-registration-cookie.js";
import { getExpectedWebAuthnOrigin, readRequestOrigin } from "../auth/webauthn-origin.js";
import { PasskeyRegistrationOptionsResponseMapper } from "../mappers/passkey-registration-options-response-mapper.js";
import { UserResponseMapper } from "../mappers/user-response-mapper.js";

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly accountEmailVerificationService: IAccountEmailVerificationService,
    private readonly signupPasskeyRegistrationService: ISignupPasskeyRegistrationService,
    private readonly passkeyAuthenticationService: IPasskeyAuthenticationService = new UnavailablePasskeyAuthenticationService(),
    private readonly sessionRestorationService?: ISessionRestorationService,
    private readonly recoveryRegistrationAuthorizationService?: IRecoveryRegistrationAuthorizationService,
    private readonly recoveryPasskeyRegistrationService?: IRecoveryPasskeyRegistrationService,
  ) {}

  async getCurrentSession(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const accessCookie = getAccessCookieConfiguration();
    const token = extractCookieValue(req.get("Cookie"), accessCookie.name);
    if (!token || !this.sessionRestorationService) {
      res.status(401).json({ error: "ACCESS_SESSION_REQUIRED" });
      return;
    }
    const user = await this.sessionRestorationService.getCurrentSession(token);
    if (!user) {
      res.status(401).json({ error: "ACCESS_SESSION_REQUIRED" });
      return;
    }
    res.status(200).json({ user: UserResponseMapper.toResponse(user), sessionTransport: "cookie" });
  }

  async refreshSession(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    const refreshCookie = getRefreshCookieConfiguration();
    const token = extractCookieValue(req.get("Cookie"), refreshCookie.name);
    if (!token || !this.sessionRestorationService) {
      res.status(401).json({ error: "REFRESH_SESSION_REQUIRED" });
      return;
    }
    try {
      const result = await this.sessionRestorationService.refresh(token);
      if (!result) {
        res.status(401).json({ error: "REFRESH_SESSION_REQUIRED" });
        return;
      }
      this.setSessionCookies(res, { ...result, rememberDevice: true }, new Date());
      res.status(200).json({ user: UserResponseMapper.toResponse(result.user), sessionTransport: "cookie" });
    } catch {
      res.status(503).json({ error: "SESSION_UNAVAILABLE" });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!this.sessionRestorationService) {
      res.status(503).json({ error: "SESSION_UNAVAILABLE" });
      return;
    }

    const accessCookie = getAccessCookieConfiguration();
    const refreshCookie = getRefreshCookieConfiguration();
    try {
      await this.sessionRestorationService.logout({
        accessToken: extractCookieValue(req.get("Cookie"), accessCookie.name) ?? undefined,
        refreshToken: extractCookieValue(req.get("Cookie"), refreshCookie.name) ?? undefined,
      });
      res.clearCookie(accessCookie.name, accessCookie.options);
      res.clearCookie(refreshCookie.name, refreshCookie.options);
      res.status(204).send();
    } catch {
      res.status(503).json({ error: "SESSION_UNAVAILABLE" });
    }
  }

  async createPasskeyAuthenticationOptions(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!req.ip) {
      res.status(503).json({ error: "PASSKEY_AUTHENTICATION_UNAVAILABLE" });
      return;
    }
    try {
      const result = await this.passkeyAuthenticationService.createAuthenticationOptions({
        origin,
        requestingIp: req.ip,
      });
      res.status(200).json({ options: result.options, expiresAt: result.expiresAt.toISOString() });
    } catch (error) {
      if (error instanceof PasskeyAuthenticationRateLimitedError) {
        res.set("Retry-After", String(error.retryAfterSeconds));
        res.status(429).json({ error: "PASSKEY_AUTHENTICATION_RATE_LIMITED" });
        return;
      }
      if (error instanceof PasskeyAuthenticationUnavailableError) {
        res.status(503).json({ error: "PASSKEY_AUTHENTICATION_UNAVAILABLE" });
        return;
      }
      res.status(500).json({ error: "PASSKEY_AUTHENTICATION_UNAVAILABLE" });
    }
  }

  async verifyPasskeyAuthentication(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!req.ip) {
      res.status(503).json({ error: "PASSKEY_AUTHENTICATION_UNAVAILABLE" });
      return;
    }
    const validatedBody = validate(VerifyPasskeyAuthenticationRequestBodySchema, req.body);
    if (!validatedBody.isValid) {
      res.status(400).json({ error: "PASSKEY_AUTHENTICATION_FAILED" });
      return;
    }
    try {
      const now = new Date();
      const result = await this.passkeyAuthenticationService.verifyAuthentication({
        origin,
        requestingIp: req.ip,
        assertion: {
          credentialId: validatedBody.data.credential.id,
          rawCredentialId: validatedBody.data.credential.rawId,
          authenticatorData: validatedBody.data.credential.response.authenticatorData,
          clientDataJSON: validatedBody.data.credential.response.clientDataJSON,
          signature: validatedBody.data.credential.response.signature,
          userHandle: validatedBody.data.credential.response.userHandle,
        },
        rememberDevice: validatedBody.data.rememberDevice,
      });
      this.setSessionCookies(res, result, now);
      const response: AuthenticatedSessionResponse = {
        user: UserResponseMapper.toResponse(result.user),
        sessionTransport: "cookie",
      };
      res.status(200).json(response);
    } catch (error) {
      this.handlePasskeyAuthenticationError(res, error);
    }
  }

  async createIdentifiedPasskeyAuthenticationOptions(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    const accountAccess = extractCookieValue(req.get("Cookie"), getAccountAccessCookieConfiguration().name);
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!accountAccess) {
      res.status(401).json({ error: "ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED" });
      return;
    }
    if (!req.ip) {
      res.status(503).json({ error: "ACCOUNT_RECOVERY_UNAVAILABLE" });
      return;
    }
    try {
      const result = await this.passkeyAuthenticationService.createIdentifiedAuthenticationOptions({
        origin,
        requestingIp: req.ip,
        accountAccessToken: accountAccess,
      });
      res.status(200).json({ options: result.options, expiresAt: result.expiresAt.toISOString() });
    } catch (error) {
      this.handlePasskeyAuthenticationError(res, error);
    }
  }

  async verifyIdentifiedPasskeyAuthentication(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    const accountAccessCookie = getAccountAccessCookieConfiguration();
    const accountAccess = extractCookieValue(req.get("Cookie"), accountAccessCookie.name);
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!accountAccess) {
      res.status(401).json({ error: "ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED" });
      return;
    }
    if (!req.ip) {
      res.status(503).json({ error: "ACCOUNT_RECOVERY_UNAVAILABLE" });
      return;
    }
    const validatedBody = validate(VerifyPasskeyAuthenticationRequestBodySchema, req.body);
    if (!validatedBody.isValid) {
      res.status(400).json({ error: "IDENTIFIED_PASSKEY_AUTHENTICATION_FAILED" });
      return;
    }
    try {
      const now = new Date();
      const result = await this.passkeyAuthenticationService.verifyIdentifiedAuthentication({
        origin,
        requestingIp: req.ip,
        accountAccessToken: accountAccess,
        assertion: {
          credentialId: validatedBody.data.credential.id,
          rawCredentialId: validatedBody.data.credential.rawId,
          authenticatorData: validatedBody.data.credential.response.authenticatorData,
          clientDataJSON: validatedBody.data.credential.response.clientDataJSON,
          signature: validatedBody.data.credential.response.signature,
          userHandle: validatedBody.data.credential.response.userHandle,
        },
        rememberDevice: validatedBody.data.rememberDevice,
      });
      this.setSessionCookies(res, result, now);
      res.clearCookie(accountAccessCookie.name, accountAccessCookie.options);
      res.status(200).json({ user: UserResponseMapper.toResponse(result.user), sessionTransport: "cookie" });
    } catch (error) {
      this.handlePasskeyAuthenticationError(res, error);
    }
  }

  async authorizeRecoveryRegistration(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    const accountAccessCookie = getAccountAccessCookieConfiguration();
    const accountAccess = extractCookieValue(req.get("Cookie"), accountAccessCookie.name);
    const body = validate(AuthorizeRecoveryRegistrationRequestBodySchema, req.body);
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    if (!accountAccess) {
      res.status(401).json({ error: "ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED" });
      return;
    }
    if (!body.isValid) {
      res.status(400).json({ error: "RECOVERY_PASSKEY_REGISTRATION_FAILED" });
      return;
    }
    if (!this.recoveryRegistrationAuthorizationService) {
      res.status(503).json({ error: "ACCOUNT_RECOVERY_UNAVAILABLE" });
      return;
    }
    try {
      const result = await this.recoveryRegistrationAuthorizationService.authorize({ accountAccessToken: accountAccess, mode: body.data.mode });
      const cookie = getRecoveryRegistrationCookieConfiguration();
      res.cookie(cookie.name, result.recoveryRegistrationToken, cookie.options);
      res.clearCookie(accountAccessCookie.name, accountAccessCookie.options);
      const response: AuthorizeRecoveryRegistrationResponse = { next: "recovery-passkey-registration", expiresAt: result.expiresAt.toISOString() };
      res.status(200).json(response);
    } catch (error) {
      res.status(error instanceof PasskeyRegistrationStateConflictError ? 409 : 503).json({ error: error instanceof PasskeyRegistrationStateConflictError ? "RECOVERY_STATE_CONFLICT" : "ACCOUNT_RECOVERY_UNAVAILABLE" });
    }
  }

  async createRecoveryPasskeyRegistrationOptions(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    const token = extractCookieValue(req.get("Cookie"), getRecoveryRegistrationCookieConfiguration().name);
    if (!token) {
      res.status(401).json({ error: "RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED" });
      return;
    }
    if (!this.recoveryPasskeyRegistrationService) {
      res.status(503).json({ error: "ACCOUNT_RECOVERY_UNAVAILABLE" });
      return;
    }
    try {
      const result = await this.recoveryPasskeyRegistrationService.createRegistrationOptions(token, origin);
      res.status(200).json(result.options);
    } catch (error) {
      if (error instanceof EnrollmentAuthorizationRequiredError) {
        res.status(401).json({ error: "RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED" });
        return;
      }
      if (error instanceof OriginNotAllowedError) {
        res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
        return;
      }
      res.status(503).json({ error: "ACCOUNT_RECOVERY_UNAVAILABLE" });
    }
  }

  async requestAccountEmailVerification(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const validatedBody = validate(RequestAccountEmailVerificationRequestBodySchema, req.body);
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
      const result = await this.accountEmailVerificationService.request({
        email: validatedBody.data.email,
        platform: validatedPlatform.data,
        requestingIp: req.ip,
      });
      const response: RequestAccountEmailVerificationResponse = {
        challengeId: result.challengeId,
        expiresInSeconds: result.expiresInSeconds,
        resendAfterSeconds: result.resendAfterSeconds,
      };
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

  async verifyAccountEmailVerification(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");
    const validatedBody = validate(VerifyAccountEmailVerificationRequestBodySchema, req.body);
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
      const result = await this.accountEmailVerificationService.verify({
        challengeId: validatedBody.data.challengeId,
        code: validatedBody.data.code,
        platform: validatedPlatform.data,
      });

      const response: VerifyAccountEmailVerificationResponse =
        result.next === "passkey-registration"
          ? (() => {
              const cookie = getEnrollmentCookieConfiguration();
              res.cookie(cookie.name, result.enrollmentToken, cookie.options);
              return { next: "passkey-registration" as const, expiresAt: result.expiresAt.toISOString() };
            })()
          : (() => {
              this.clearEnrollmentCookie(res);
              const cookie = getAccountAccessCookieConfiguration();
              res.cookie(cookie.name, result.accountAccessToken, cookie.options);
              return { next: "login-or-recovery" as const, expiresAt: result.expiresAt.toISOString() };
            })();
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

  async createPasskeyRegistrationOptions(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");

    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      this.respondPasskeyRegistrationError(res, 403, "ORIGIN_NOT_ALLOWED");
      return;
    }

    const enrollmentCookie = getEnrollmentCookieConfiguration();
    const enrollmentToken = extractCookieValue(req.get("Cookie"), enrollmentCookie.name);
    if (!enrollmentToken) {
      this.clearEnrollmentCookie(res);
      this.respondPasskeyRegistrationError(res, 401, "ENROLLMENT_AUTHORIZATION_REQUIRED");
      return;
    }

    try {
      const result = await this.signupPasskeyRegistrationService.createRegistrationOptions(
        enrollmentToken,
        origin,
      );
      res.status(200).json(PasskeyRegistrationOptionsResponseMapper.toResponse(result.options));
    } catch (error) {
      this.handlePasskeyRegistrationError(res, error);
    }
  }

  async verifyPasskeyRegistration(req: Request, res: Response): Promise<void> {
    res.set("Cache-Control", "no-store");

    const origin = readRequestOrigin(req.get("Origin"));
    if (!origin || origin !== getExpectedWebAuthnOrigin()) {
      this.respondPasskeyRegistrationError(res, 403, "ORIGIN_NOT_ALLOWED");
      return;
    }

    const enrollmentCookie = getEnrollmentCookieConfiguration();
    const enrollmentToken = extractCookieValue(req.get("Cookie"), enrollmentCookie.name);
    if (!enrollmentToken) {
      this.clearEnrollmentCookie(res);
      this.respondPasskeyRegistrationError(res, 401, "ENROLLMENT_AUTHORIZATION_REQUIRED");
      return;
    }

    const validatedBody = validate(VerifyPasskeyRegistrationRequestBodySchema, req.body);
    if (!validatedBody.isValid) {
      res.status(400).json({ error: "Validation failed" });
      return;
    }

    try {
      const now = new Date();
      const result = await this.signupPasskeyRegistrationService.verifyRegistration({
        enrollmentToken,
        origin,
        attestation: {
          credentialId: validatedBody.data.credential.id,
          rawCredentialId: validatedBody.data.credential.rawId,
          clientDataJSON: validatedBody.data.credential.response.clientDataJSON,
          attestationObject: validatedBody.data.credential.response.attestationObject,
          transports: validatedBody.data.credential.response.transports,
        },
        rememberDevice: validatedBody.data.rememberDevice,
      });

      this.clearEnrollmentCookie(res);

      const accessCookie = getAccessCookieConfiguration();
      res.cookie(accessCookie.name, result.accessToken, {
        ...accessCookie.options,
        maxAge: getAccessCookieMaxAgeMs(result.accessInactivityExpiresAt, now),
      });

      const refreshCookie = getRefreshCookieConfiguration();
      const refreshOptions = { ...refreshCookie.options };
      if (result.rememberDevice) {
        refreshOptions.maxAge = getRefreshCookieMaxAgeMs(
          result.familyInactivityExpiresAt,
          result.familyAbsoluteExpiresAt,
          now,
        );
      }
      res.cookie(refreshCookie.name, result.refreshToken, refreshOptions);

      const response: AuthenticatedSessionResponse = {
        user: UserResponseMapper.toResponse(result.user),
        sessionTransport: "cookie",
      };
      res.status(200).json(response);
    } catch (error) {
      this.handlePasskeyRegistrationError(res, error);
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

  private handlePasskeyRegistrationError(res: Response, error: unknown): void {
    if (error instanceof OriginNotAllowedError) {
      this.respondPasskeyRegistrationError(res, 403, "ORIGIN_NOT_ALLOWED");
      return;
    }
    if (error instanceof EnrollmentAuthorizationRequiredError) {
      this.clearEnrollmentCookie(res);
      this.respondPasskeyRegistrationError(res, 401, "ENROLLMENT_AUTHORIZATION_REQUIRED");
      return;
    }
    if (error instanceof PasskeyRegistrationFailedError) {
      this.respondPasskeyRegistrationError(res, 400, "PASSKEY_REGISTRATION_FAILED");
      return;
    }
    if (error instanceof PasskeyRegistrationStateConflictError) {
      this.respondPasskeyRegistrationError(res, 409, "PASSKEY_REGISTRATION_STATE_CONFLICT");
      return;
    }
    if (error instanceof PasskeyRegistrationRateLimitedError) {
      res.set("Retry-After", String(error.retryAfterSeconds));
      this.respondPasskeyRegistrationError(res, 429, "PASSKEY_REGISTRATION_RATE_LIMITED");
      return;
    }
    if (error instanceof PasskeyRegistrationUnavailableError || error instanceof ServiceUnavailableError) {
      this.respondPasskeyRegistrationError(res, 503, "PASSKEY_REGISTRATION_UNAVAILABLE");
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }

  private respondPasskeyRegistrationError(
    res: Response,
    status: number,
    error: PasskeyRegistrationErrorResponse["error"],
  ): void {
    res.status(status).json({ error } satisfies PasskeyRegistrationErrorResponse);
  }

  private clearEnrollmentCookie(res: Response): void {
    const enrollmentCookie = getEnrollmentCookieConfiguration();
    res.clearCookie(enrollmentCookie.name, enrollmentCookie.options);
  }

  private setSessionCookies(
    res: Response,
    result: {
      accessToken: string;
      refreshToken: string;
      rememberDevice: boolean;
      accessInactivityExpiresAt: Date;
      familyInactivityExpiresAt: Date;
      familyAbsoluteExpiresAt: Date;
    },
    now: Date,
  ): void {
    const accessCookie = getAccessCookieConfiguration();
    res.cookie(accessCookie.name, result.accessToken, {
      ...accessCookie.options,
      maxAge: getAccessCookieMaxAgeMs(result.accessInactivityExpiresAt, now),
    });
    const refreshCookie = getRefreshCookieConfiguration();
    const refreshOptions = { ...refreshCookie.options };
    if (result.rememberDevice) {
      refreshOptions.maxAge = getRefreshCookieMaxAgeMs(
        result.familyInactivityExpiresAt,
        result.familyAbsoluteExpiresAt,
        now,
      );
    }
    res.cookie(refreshCookie.name, result.refreshToken, refreshOptions);
  }

  private handlePasskeyAuthenticationError(res: Response, error: unknown): void {
    if (error instanceof PasskeyAuthenticationRateLimitedError) {
      res.set("Retry-After", String(error.retryAfterSeconds));
      res.status(429).json({ error: "PASSKEY_AUTHENTICATION_RATE_LIMITED" });
      return;
    }
    if (error instanceof PasskeyAuthenticationStateConflictError) {
      res.status(409).json({ error: "PASSKEY_AUTHENTICATION_STATE_CONFLICT" });
      return;
    }
    if (error instanceof PasskeyAuthenticationFailedError) {
      res.status(400).json({ error: "PASSKEY_AUTHENTICATION_FAILED" });
      return;
    }
    res.status(503).json({ error: "PASSKEY_AUTHENTICATION_UNAVAILABLE" });
  }
}
