import {
  IAccessTokenService,
  IDayLogRepository,
  IPasswordHasher,
  IAuthService,
  IUserRepository,
  IUserService,
  IEmailOtpCodeService,
  IClock,
  IEmailSender,
  SystemClock,
} from "@application";
import { AuthController, DayLogController, UserController } from "@controllers";
import dotenvx from "@dotenvx/dotenvx";
import {
  AuthServiceImpl,
  IDayLogService,
  DayLogServiceImpl,
  UserServiceImpl,
  ISignupEmailVerificationService,
  SignupEmailVerificationServiceImpl,
  UnavailableSignupEmailVerificationService,
} from "@services";
import { createSecretKey } from "crypto";

import { BrevoEmailSender } from "./email/brevo-email-sender.js";
import {
  PostgresDayLogRepository,
  PostgresEmailOtpChallengeRepository,
  PostgresUserRepository,
} from "./persistence/repositories/index.js";
import { Argon2PasswordHasher, JoseAccessTokenService, NodeEmailOtpCodeService } from "./security/index.js";

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
    this.userRepository = userRepository ?? new PostgresUserRepository();
    this.dayLogRepository = dayLogRepository ?? new PostgresDayLogRepository();
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
            new PostgresEmailOtpChallengeRepository({
              ipDigestKey: ipDigestKeyBytes,
              globalHourlyLimit,
            }),
            this.emailOtpCodeService,
            configuredEmailSender,
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
