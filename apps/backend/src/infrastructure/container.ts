import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IClock, SystemClock } from "@application/ports/clock.js";
import { IDayLogRepository } from "@application/ports/day-log-repository.js";
import { IEmailOtpCodeService } from "@application/ports/email-otp-code-service.js";
import { IEmailSender } from "@application/ports/email-sender.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import { IAuthService, AuthServiceImpl } from "@application/services/auth-service.js";
import { IDayLogService, DayLogServiceImpl } from "@application/services/day-log-service.js";
import {
  ISignupEmailVerificationService,
  SignupEmailVerificationServiceImpl,
  UnavailableSignupEmailVerificationService,
} from "@application/services/signup-email-verification-service.js";
import { IUserService, UserServiceImpl } from "@application/services/user-service.js";
import { AuthController } from "@controllers/auth-controller.js";
import { DayLogController } from "@controllers/day-log-controller.js";
import { UserController } from "@controllers/user-controller.js";
import dotenvx from "@dotenvx/dotenvx";
import { createSecretKey } from "crypto";

import { BrevoEmailSender } from "./email/brevo-email-sender.js";
import { databaseClient } from "./persistence/database.js";
import { PostgresDayLogRepository } from "./persistence/repositories/postgres-day-log-repository.js";
import { PostgresEmailOtpChallengeRepository } from "./persistence/repositories/postgres-email-otp-challenge-repository.js";
import { PostgresSignupEnrollmentAuthorizationRepository } from "./persistence/repositories/postgres-signup-enrollment-authorization-repository.js";
import { PostgresUserRepository } from "./persistence/repositories/postgres-user-repository.js";
import { Argon2PasswordHasher } from "./security/argon2-password-hasher.js";
import { JoseAccessTokenService } from "./security/jose-access-token-service.js";
import { NodeEmailOtpCodeService } from "./security/node-email-otp-code-service.js";
import { NodeOpaqueTokenService } from "./security/node-session-token-service.js";

const encodedKey = dotenvx.get("OTP_HMAC_KEY");

if (!encodedKey) {
  throw new Error("OTP_HMAC_KEY is not configured");
}

const keyBytes = Buffer.from(encodedKey, "base64url");

if (keyBytes.byteLength < 32) {
  throw new Error("The email OTP HMAC key must contain at least 32 bytes");
}

const keyVersion = Number(dotenvx.get("OTP_HMAC_CURRENT_KEY_VERSION") ?? "1");

const otpHmacKey = createSecretKey(keyBytes);
const encodedIpDigestKey = dotenvx.get("EMAIL_REQUEST_IP_HMAC_KEY");

if (!encodedIpDigestKey) {
  throw new Error("EMAIL_REQUEST_IP_HMAC_KEY is not configured");
}

const ipDigestKeyBytes = Buffer.from(encodedIpDigestKey, "hex");

if (ipDigestKeyBytes.byteLength < 32) {
  throw new Error("The email request IP HMAC key must contain at least 32 bytes");
}

const globalHourlyLimit = Number(dotenvx.get("EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT") ?? "1000");

if (!Number.isInteger(globalHourlyLimit) || globalHourlyLimit < 1) {
  throw new Error("EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT must be a positive integer");
}

const trustProxyHops = Number(dotenvx.get("TRUST_PROXY_HOPS") ?? "0");

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

const emailServiceCredential = dotenvx.get("EMAIL_SERVICE_CREDENTIAL");

export class Container {
  private readonly accessTokenService: IAccessTokenService;
  private readonly authController: AuthController;
  private readonly authService: IAuthService;
  private readonly emailOtpCodeService: IEmailOtpCodeService;
  private readonly signupEmailVerificationService: ISignupEmailVerificationService;
  private readonly dayLogRepository: IDayLogRepository;
  private readonly dayLogService: IDayLogService;
  private readonly dayLogController: DayLogController;
  private readonly userRepository: IUserRepository;
  private readonly userService: IUserService;
  private readonly userController: UserController;
  private readonly passwordHasher: IPasswordHasher;

  constructor({
    accessTokenService,
    authController,
    authService,
    emailOtpCodeService,
    signupEmailVerificationService,
    emailSender,
    clock,
    dayLogRepository,
    dayLogService,
    dayLogController,
    userRepository,
    userService,
    userController,
    passwordHasher,
  }: {
    accessTokenService?: IAccessTokenService;
    authController?: AuthController;
    authService?: IAuthService;
    emailOtpCodeService?: IEmailOtpCodeService;
    signupEmailVerificationService?: ISignupEmailVerificationService;
    emailSender?: IEmailSender;
    clock?: IClock;
    dayLogRepository?: IDayLogRepository;
    dayLogService?: IDayLogService;
    dayLogController?: DayLogController;
    userRepository?: IUserRepository;
    userService?: IUserService;
    userController?: UserController;
    passwordHasher?: IPasswordHasher;
  }) {
    this.userRepository = userRepository ?? new PostgresUserRepository(databaseClient);
    this.dayLogRepository = dayLogRepository ?? new PostgresDayLogRepository(databaseClient);
    this.dayLogService = dayLogService ?? new DayLogServiceImpl(this.dayLogRepository, this.userRepository);
    this.dayLogController = dayLogController ?? new DayLogController(this.dayLogService);

    this.passwordHasher = passwordHasher ?? new Argon2PasswordHasher();
    this.accessTokenService = accessTokenService ?? new JoseAccessTokenService();
    this.authService =
      authService ?? new AuthServiceImpl(this.passwordHasher, this.userRepository, this.accessTokenService);

    this.emailOtpCodeService =
      emailOtpCodeService ?? new NodeEmailOtpCodeService({ key: otpHmacKey, keyVersion });
    const configuredEmailSender =
      emailSender ?? (emailServiceCredential ? new BrevoEmailSender(emailServiceCredential) : null);
    this.signupEmailVerificationService =
      signupEmailVerificationService ??
      (configuredEmailSender
        ? new SignupEmailVerificationServiceImpl(
            new PostgresEmailOtpChallengeRepository(
              {
                ipDigestKey: ipDigestKeyBytes,
                globalHourlyLimit,
              },
              databaseClient,
            ),
            this.emailOtpCodeService,
            configuredEmailSender,
            new PostgresSignupEnrollmentAuthorizationRepository(databaseClient),
            new NodeOpaqueTokenService(),
            clock ?? new SystemClock(),
          )
        : new UnavailableSignupEmailVerificationService());

    this.authController =
      authController ?? new AuthController(this.authService, this.signupEmailVerificationService);
    this.userService = userService ?? new UserServiceImpl(this.passwordHasher, this.userRepository);
    this.userController = userController ?? new UserController(this.userService);
  }

  getAccessTokenService(): IAccessTokenService {
    return this.accessTokenService;
  }
  getAuthController(): AuthController {
    return this.authController;
  }
  getAuthService(): IAuthService {
    return this.authService;
  }
  getSignupEmailVerificationService(): ISignupEmailVerificationService {
    return this.signupEmailVerificationService;
  }
  getTrustProxyHops(): number {
    return trustProxyHops;
  }
  getDayLogService(): IDayLogService {
    return this.dayLogService;
  }
  getDayLogRepository(): IDayLogRepository {
    return this.dayLogRepository;
  }
  getDayLogController(): DayLogController {
    return this.dayLogController;
  }
  getUserService(): IUserService {
    return this.userService;
  }
  getUserRepository(): IUserRepository {
    return this.userRepository;
  }
  getUserController(): UserController {
    return this.userController;
  }
  getPasswordHasher(): IPasswordHasher {
    return this.passwordHasher;
  }
}
