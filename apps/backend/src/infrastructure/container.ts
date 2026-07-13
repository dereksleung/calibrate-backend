import {
  IAccessTokenService,
  IDayLogRepository,
  IPasswordHasher,
  IAuthService,
  IEmailOtpService,
  IUserRepository,
  IUserService,
  IEmailOtpCodeService,
  IClock,
  IEmailSender,
  ISessionTokenService,
} from "@application";
import { AuthController, DayLogController, UserController } from "@controllers";
import dotenvx from "@dotenvx/dotenvx";
import {
  AuthServiceImpl,
  IDayLogService,
  DayLogServiceImpl,
  UserServiceImpl,
  EmailOtpServiceImpl,
} from "@services";
import { createSecretKey } from "crypto";

import {
  PostgresDayLogRepository,
  PostgresEmailOtpChallengeRepository,
  PostgresUserRepository,
} from "./persistence/repositories/index.js";
import {
  Argon2PasswordHasher,
  JoseAccessTokenService,
  NodeEmailOtpCodeService,
  NodeSessionTokenService,
} from "./security/index.js";

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
const nodeEnvironment = dotenvx.get("NODE_ENV") ?? "development";
const configuredWebOrigin = dotenvx.get("WEB_APP_ORIGIN");
const webOrigin = configuredWebOrigin ?? (nodeEnvironment === "development" ? "http://localhost:3000" : null);

if (!webOrigin) {
  throw new Error("WEB_APP_ORIGIN is not configured");
}

const secureSessionCookie = new URL(webOrigin).protocol === "https:";

class UnavailableEmailSender implements IEmailSender {
  async sendAuthenticationCode(): Promise<void> {
    throw new Error("Email delivery is not configured");
  }
}

export class Container {
  private readonly accessTokenService: IAccessTokenService;
  private readonly authController: AuthController;
  private readonly authService: IAuthService;
  private readonly emailOtpCodeService: IEmailOtpCodeService;
  private readonly sessionTokenService: ISessionTokenService;
  private readonly emailOtpService: IEmailOtpService;
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
    emailOtpService,
    emailSender,
    clock,
    sessionTokenService,
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
    emailOtpService?: IEmailOtpService;
    emailSender?: IEmailSender;
    clock?: IClock;
    sessionTokenService?: ISessionTokenService;
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
    this.sessionTokenService = sessionTokenService ?? new NodeSessionTokenService();
    this.emailOtpService =
      emailOtpService ??
      new EmailOtpServiceImpl(
        new PostgresEmailOtpChallengeRepository(),
        this.emailOtpCodeService,
        emailSender ?? new UnavailableEmailSender(),
        clock ?? { now: () => new Date() },
        this.sessionTokenService,
      );

    this.authController =
      authController ??
      new AuthController(this.authService, this.emailOtpService, {
        webOrigin,
        sessionCookie: {
          name: secureSessionCookie ? "__Host-calibrate_session" : "calibrate_session",
          secure: secureSessionCookie,
        },
      });
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
  getEmailOtpService(): IEmailOtpService {
    return this.emailOtpService;
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
