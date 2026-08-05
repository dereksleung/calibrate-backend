import { IAccessSessionRepository, IRefreshSessionRepository } from "@application/ports/access-session-repository.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IClock, SystemClock } from "@application/ports/clock.js";
import { IDayLogRepository } from "@application/ports/day-log-repository.js";
import { IEmailOtpCodeService } from "@application/ports/email-otp-code-service.js";
import { IEmailSender } from "@application/ports/email-sender.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import { IAuthService, AuthServiceImpl } from "@application/services/auth-service.js";
import { ISessionRestorationService, SessionRestorationServiceImpl } from "@application/services/session-restoration-service.js";
import { IDayLogService, DayLogServiceImpl } from "@application/services/day-log-service.js";
import {
  IPasskeyAuthenticationService,
  PasskeyAuthenticationServiceImpl,
} from "@application/services/passkey-authentication-service.js";
import {
  IAccountEmailVerificationService,
  AccountEmailVerificationServiceImpl,
  UnavailableAccountEmailVerificationService,
} from "@application/services/account-email-verification-service.js";
import {
  ISignupPasskeyRegistrationService,
  SignupPasskeyRegistrationServiceImpl,
  UnavailableSignupPasskeyRegistrationService,
} from "@application/services/signup-passkey-registration-service.js";
import {
  IRecoveryRegistrationAuthorizationService,
  RecoveryRegistrationAuthorizationServiceImpl,
} from "@application/services/recovery-registration-authorization-service.js";
import {
  IRecoveryPasskeyRegistrationService,
  RecoveryPasskeyRegistrationServiceImpl,
} from "@application/services/recovery-passkey-registration-service.js";
import { IUserService, UserServiceImpl } from "@application/services/user-service.js";
import { AuthController } from "@controllers/auth-controller.js";
import { DayLogController } from "@controllers/day-log-controller.js";
import { UserController } from "@controllers/user-controller.js";
import dotenvx from "@dotenvx/dotenvx";
import { createSecretKey } from "crypto";

import { BrevoEmailSender } from "./email/brevo-email-sender.js";
import { databaseClient } from "./persistence/database.js";
import { PostgresAccessSessionRepository } from "./persistence/repositories/postgres-access-session-repository.js";
import { PostgresDayLogRepository } from "./persistence/repositories/postgres-day-log-repository.js";
import { PostgresEmailOtpChallengeRepository } from "./persistence/repositories/postgres-email-otp-challenge-repository.js";
import { PostgresPasskeyAuthenticationRepository } from "./persistence/repositories/postgres-passkey-authentication-repository.js";
import { PostgresSignupEnrollmentAuthorizationRepository } from "./persistence/repositories/postgres-signup-enrollment-authorization-repository.js";
import { PostgresSignupPasskeyRegistrationRepository } from "./persistence/repositories/postgres-signup-passkey-registration-repository.js";
import { PostgresRecoveryRegistrationAuthorizationRepository } from "./persistence/repositories/postgres-recovery-registration-authorization-repository.js";
import { PostgresRecoveryPasskeyRegistrationRepository } from "./persistence/repositories/postgres-recovery-passkey-registration-repository.js";
import { PostgresUserRepository } from "./persistence/repositories/postgres-user-repository.js";
import { Argon2PasswordHasher } from "./security/argon2-password-hasher.js";
import { JoseAccessTokenService } from "./security/jose-access-token-service.js";
import { NodeEmailOtpCodeService } from "./security/node-email-otp-code-service.js";
import { NodeOpaqueTokenService } from "./security/node-session-token-service.js";
import { SimpleWebAuthnAuthenticationAdapter } from "./webauthn/simple-webauthn-authentication-adapter.js";
import { SimpleWebAuthnRegistrationAdapter } from "./webauthn/simple-webauthn-registration-adapter.js";

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

const webAuthnRpId = dotenvx.get("WEBAUTHN_RP_ID") ?? "localhost";
const webAuthnOrigin = dotenvx.get("WEBAUTHN_ORIGIN") ?? "http://localhost:3000";
const webAuthnRpName = dotenvx.get("WEBAUTHN_RP_NAME") ?? "Calibrate";

export class Container {
  private readonly accessSessionRepository: IRefreshSessionRepository;
  private readonly accessTokenService: IAccessTokenService;
  private readonly authController: AuthController;
  private readonly authService: IAuthService;
  private readonly clock: IClock;
  private readonly emailOtpCodeService: IEmailOtpCodeService;
  private readonly accountEmailVerificationService: IAccountEmailVerificationService;
  private readonly signupPasskeyRegistrationService: ISignupPasskeyRegistrationService;
  private readonly passkeyAuthenticationService: IPasskeyAuthenticationService;
  private readonly recoveryRegistrationAuthorizationService: IRecoveryRegistrationAuthorizationService;
  private readonly recoveryPasskeyRegistrationService: IRecoveryPasskeyRegistrationService;
  private readonly sessionRestorationService: ISessionRestorationService;
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
    accountEmailVerificationService,
    signupPasskeyRegistrationService,
    passkeyAuthenticationService,
    recoveryRegistrationAuthorizationService,
    recoveryPasskeyRegistrationService,
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
    accountEmailVerificationService?: IAccountEmailVerificationService;
    signupPasskeyRegistrationService?: ISignupPasskeyRegistrationService;
    passkeyAuthenticationService?: IPasskeyAuthenticationService;
    recoveryRegistrationAuthorizationService?: IRecoveryRegistrationAuthorizationService;
    recoveryPasskeyRegistrationService?: IRecoveryPasskeyRegistrationService;
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
    this.clock = clock ?? new SystemClock();
    this.accessSessionRepository = new PostgresAccessSessionRepository(databaseClient);
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
    this.accountEmailVerificationService =
      accountEmailVerificationService ??
      (configuredEmailSender
        ? new AccountEmailVerificationServiceImpl(
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
            this.clock,
          )
        : new UnavailableAccountEmailVerificationService());

    this.signupPasskeyRegistrationService =
      signupPasskeyRegistrationService ??
      (configuredEmailSender
        ? new SignupPasskeyRegistrationServiceImpl(
            new PostgresSignupPasskeyRegistrationRepository(databaseClient),
            new SimpleWebAuthnRegistrationAdapter({
              rpId: webAuthnRpId,
              rpName: webAuthnRpName,
              origin: webAuthnOrigin,
            }),
            new NodeOpaqueTokenService(),
            configuredEmailSender,
            this.clock,
            { expectedOrigin: webAuthnOrigin },
          )
        : new UnavailableSignupPasskeyRegistrationService());

    this.passkeyAuthenticationService =
      passkeyAuthenticationService ??
      new PasskeyAuthenticationServiceImpl(
        new PostgresPasskeyAuthenticationRepository({ ipDigestKey: ipDigestKeyBytes }, databaseClient),
        new SimpleWebAuthnAuthenticationAdapter({ rpId: webAuthnRpId }),
        new NodeOpaqueTokenService(),
        this.userRepository,
        this.clock,
        { expectedOrigin: webAuthnOrigin },
      );

    this.recoveryRegistrationAuthorizationService =
      recoveryRegistrationAuthorizationService ??
      new RecoveryRegistrationAuthorizationServiceImpl(
        new PostgresRecoveryRegistrationAuthorizationRepository(databaseClient),
        new NodeOpaqueTokenService(),
        this.clock,
      );

    this.recoveryPasskeyRegistrationService =
      recoveryPasskeyRegistrationService ??
      new RecoveryPasskeyRegistrationServiceImpl(
        new PostgresRecoveryPasskeyRegistrationRepository(databaseClient),
        new SimpleWebAuthnRegistrationAdapter({
          rpId: webAuthnRpId,
          rpName: webAuthnRpName,
          origin: webAuthnOrigin,
        }),
        this.clock,
        { expectedOrigin: webAuthnOrigin },
      );

    this.sessionRestorationService = new SessionRestorationServiceImpl(
      this.accessSessionRepository,
      new NodeOpaqueTokenService(),
      this.userRepository,
      this.clock,
    );

    this.authController =
      authController ??
      new AuthController(
        this.authService,
        this.accountEmailVerificationService,
        this.signupPasskeyRegistrationService,
        this.passkeyAuthenticationService,
        this.sessionRestorationService,
        this.recoveryRegistrationAuthorizationService,
        this.recoveryPasskeyRegistrationService,
      );
    this.userService = userService ?? new UserServiceImpl(this.passwordHasher, this.userRepository);
    this.userController = userController ?? new UserController(this.userService);
  }

  getAccessSessionRepository(): IAccessSessionRepository {
    return this.accessSessionRepository;
  }
  getAccessTokenService(): IAccessTokenService {
    return this.accessTokenService;
  }
  getClock(): IClock {
    return this.clock;
  }
  getAuthController(): AuthController {
    return this.authController;
  }
  getAuthService(): IAuthService {
    return this.authService;
  }
  getAccountEmailVerificationService(): IAccountEmailVerificationService {
    return this.accountEmailVerificationService;
  }
  getSignupPasskeyRegistrationService(): ISignupPasskeyRegistrationService {
    return this.signupPasskeyRegistrationService;
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
