import type { IFoodCatalogImporter } from "@application/ports/food-catalog-importer.js";

import {
  IAccessSessionRepository,
  IRefreshSessionRepository,
} from "@application/ports/access-session-repository.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IClock, SystemClock } from "@application/ports/clock.js";
import { IDayLogRepository } from "@application/ports/day-log-repository.js";
import { IEmailOtpCodeService } from "@application/ports/email-otp-code-service.js";
import { IEmailSender } from "@application/ports/email-sender.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import {
  IAccountEmailVerificationService,
  AccountEmailVerificationServiceImpl,
  UnavailableAccountEmailVerificationService,
} from "@application/services/account-email-verification-service.js";
import { IAuthService, AuthServiceImpl } from "@application/services/auth-service.js";
import { IDayLogService, DayLogServiceImpl } from "@application/services/day-log-service.js";
import { FoodCatalogSearchService } from "@application/services/food-catalog-search-service.js";
import {
  ILocalDevelopmentPasskeyEnrollmentService,
  LocalDevelopmentPasskeyEnrollmentService,
} from "@application/services/local-development-passkey-enrollment-service.js";
import {
  ILocalDevelopmentTestSessionService,
  LocalDevelopmentTestSessionService,
} from "@application/services/local-development-test-session-service.js";
import {
  IPasskeyAuthenticationService,
  PasskeyAuthenticationServiceImpl,
} from "@application/services/passkey-authentication-service.js";
import {
  ISessionRestorationService,
  SessionRestorationServiceImpl,
} from "@application/services/session-restoration-service.js";
import {
  ISignupPasskeyRegistrationService,
  SignupPasskeyRegistrationServiceImpl,
} from "@application/services/signup-passkey-registration-service.js";
import { IUserService, UserServiceImpl } from "@application/services/user-service.js";
import { AuthController } from "@controllers/auth-controller.js";
import { DayLogController } from "@controllers/day-log-controller.js";
import { FoodSearchController } from "@controllers/food-search-controller.js";
import { UserController } from "@controllers/user-controller.js";
import { createSecretKey } from "crypto";

import { BrevoEmailSender } from "./email/brevo-email-sender.js";
import { NoopEmailSender } from "./email/noop-email-sender.js";
import { FoodDataCentralCatalogImporter } from "./food-data-central/food-data-central-catalog-importer.js";
import { databaseClient } from "./persistence/database.js";
import { PostgresAccessSessionRepository } from "./persistence/repositories/postgres-access-session-repository.js";
import { PostgresDayLogRepository } from "./persistence/repositories/postgres-day-log-repository.js";
import { PostgresEmailOtpChallengeRepository } from "./persistence/repositories/postgres-email-otp-challenge-repository.js";
import { PostgresFoodCatalogSearchQuery } from "./persistence/repositories/postgres-food-catalog-search-query.js";
import { PostgresFoodCatalogWriter } from "./persistence/repositories/postgres-food-catalog-writer.js";
import { PostgresLocalDevelopmentTestSessionRepository } from "./persistence/repositories/postgres-local-development-test-session-repository.js";
import { PostgresPasskeyAuthenticationRepository } from "./persistence/repositories/postgres-passkey-authentication-repository.js";
import { PostgresRecentFoodQuery } from "./persistence/repositories/postgres-recent-food-query.js";
import { PostgresSignupEnrollmentAuthorizationRepository } from "./persistence/repositories/postgres-signup-enrollment-authorization-repository.js";
import { PostgresSignupPasskeyRegistrationRepository } from "./persistence/repositories/postgres-signup-passkey-registration-repository.js";
import { PostgresUserRepository } from "./persistence/repositories/postgres-user-repository.js";
import { getRuntimeEnvironmentValue, isE2eRuntime } from "./runtime-environment.js";
import { Argon2PasswordHasher } from "./security/argon2-password-hasher.js";
import { JoseAccessTokenService } from "./security/jose-access-token-service.js";
import { NodeEmailOtpCodeService } from "./security/node-email-otp-code-service.js";
import { NodeOpaqueTokenService } from "./security/node-session-token-service.js";
import { SimpleWebAuthnAuthenticationAdapter } from "./webauthn/simple-webauthn-authentication-adapter.js";
import { SimpleWebAuthnRegistrationAdapter } from "./webauthn/simple-webauthn-registration-adapter.js";

const encodedKey = getRuntimeEnvironmentValue("OTP_HMAC_KEY");

if (!encodedKey) {
  throw new Error("OTP_HMAC_KEY is not configured");
}

const keyBytes = Buffer.from(encodedKey, "base64url");

if (keyBytes.byteLength < 32) {
  throw new Error("The email OTP HMAC key must contain at least 32 bytes");
}

const keyVersion = Number(getRuntimeEnvironmentValue("OTP_HMAC_CURRENT_KEY_VERSION") ?? "1");

const otpHmacKey = createSecretKey(keyBytes);
const encodedIpDigestKey = getRuntimeEnvironmentValue("EMAIL_REQUEST_IP_HMAC_KEY");

if (!encodedIpDigestKey) {
  throw new Error("EMAIL_REQUEST_IP_HMAC_KEY is not configured");
}

const ipDigestKeyBytes = Buffer.from(encodedIpDigestKey, "hex");

if (ipDigestKeyBytes.byteLength < 32) {
  throw new Error("The email request IP HMAC key must contain at least 32 bytes");
}

const globalHourlyLimit = Number(
  getRuntimeEnvironmentValue("EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT") ?? "1000",
);

if (!Number.isInteger(globalHourlyLimit) || globalHourlyLimit < 1) {
  throw new Error("EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT must be a positive integer");
}

const trustProxyHops = Number(getRuntimeEnvironmentValue("TRUST_PROXY_HOPS") ?? "0");

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

const emailServiceCredential = getRuntimeEnvironmentValue("EMAIL_SERVICE_CREDENTIAL");

const webAuthnRpId = getRuntimeEnvironmentValue("WEBAUTHN_RP_ID") ?? "localhost";
const webAuthnOrigin = getRuntimeEnvironmentValue("WEBAUTHN_ORIGIN") ?? "http://localhost:3000";
const webAuthnRpName = getRuntimeEnvironmentValue("WEBAUTHN_RP_NAME") ?? "Calibrate";
const foodDataCentralApiKey = getRuntimeEnvironmentValue("FOODDATA_CENTRAL_API_KEY");

export class Container {
  private readonly accessSessionRepository: IRefreshSessionRepository;
  private readonly accessTokenService: IAccessTokenService;
  private readonly authController: AuthController;
  private readonly authService: IAuthService;
  private readonly clock: IClock;
  private readonly emailOtpCodeService: IEmailOtpCodeService;
  private readonly accountEmailVerificationService: IAccountEmailVerificationService;
  private readonly localDevelopmentPasskeyEnrollmentService: ILocalDevelopmentPasskeyEnrollmentService;
  private readonly localDevelopmentTestSessionService: ILocalDevelopmentTestSessionService;
  private readonly signupPasskeyRegistrationService: ISignupPasskeyRegistrationService;
  private readonly passkeyAuthenticationService: IPasskeyAuthenticationService;
  private readonly sessionRestorationService: ISessionRestorationService;
  private readonly dayLogRepository: IDayLogRepository;
  private readonly dayLogService: IDayLogService;
  private readonly dayLogController: DayLogController;
  private readonly foodSearchController: FoodSearchController;
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
    localDevelopmentPasskeyEnrollmentService,
    localDevelopmentTestSessionService,
    signupPasskeyRegistrationService,
    passkeyAuthenticationService,
    emailSender,
    clock,
    dayLogRepository,
    dayLogService,
    dayLogController,
    foodSearchController,
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
    localDevelopmentPasskeyEnrollmentService?: ILocalDevelopmentPasskeyEnrollmentService;
    localDevelopmentTestSessionService?: ILocalDevelopmentTestSessionService;
    signupPasskeyRegistrationService?: ISignupPasskeyRegistrationService;
    passkeyAuthenticationService?: IPasskeyAuthenticationService;
    emailSender?: IEmailSender;
    clock?: IClock;
    dayLogRepository?: IDayLogRepository;
    dayLogService?: IDayLogService;
    dayLogController?: DayLogController;
    foodSearchController?: FoodSearchController;
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
    const catalogWriter = new PostgresFoodCatalogWriter(databaseClient);
    const importer: IFoodCatalogImporter = foodDataCentralApiKey
      ? new FoodDataCentralCatalogImporter({ apiKey: foodDataCentralApiKey, writer: catalogWriter })
      : {
          searchAndImport: async () => {
            throw new Error("Food catalog provider is unavailable");
          },
        };
    this.foodSearchController =
      foodSearchController ??
      new FoodSearchController(
        new FoodCatalogSearchService(
          new PostgresFoodCatalogSearchQuery(databaseClient),
          new PostgresRecentFoodQuery(databaseClient),
          importer,
        ),
      );

    this.passwordHasher = passwordHasher ?? new Argon2PasswordHasher();
    this.accessTokenService = accessTokenService ?? new JoseAccessTokenService();
    this.authService =
      authService ?? new AuthServiceImpl(this.passwordHasher, this.userRepository, this.accessTokenService);

    this.emailOtpCodeService =
      emailOtpCodeService ?? new NodeEmailOtpCodeService({ key: otpHmacKey, keyVersion });
    const configuredEmailSender =
      emailSender ??
      (isE2eRuntime()
        ? new NoopEmailSender()
        : emailServiceCredential
          ? new BrevoEmailSender(emailServiceCredential)
          : null);
    const passkeyEmailSender = configuredEmailSender ?? new NoopEmailSender();
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
      new SignupPasskeyRegistrationServiceImpl(
        new PostgresSignupPasskeyRegistrationRepository(databaseClient),
        new SimpleWebAuthnRegistrationAdapter({
          rpId: webAuthnRpId,
          rpName: webAuthnRpName,
          origin: webAuthnOrigin,
        }),
        new NodeOpaqueTokenService(),
        passkeyEmailSender,
        this.clock,
        { expectedOrigin: webAuthnOrigin },
      );

    this.localDevelopmentPasskeyEnrollmentService =
      localDevelopmentPasskeyEnrollmentService ??
      new LocalDevelopmentPasskeyEnrollmentService(
        new PostgresSignupEnrollmentAuthorizationRepository(databaseClient),
        new NodeOpaqueTokenService(),
        this.clock,
      );

    this.localDevelopmentTestSessionService =
      localDevelopmentTestSessionService ??
      new LocalDevelopmentTestSessionService(
        new PostgresLocalDevelopmentTestSessionRepository(databaseClient),
        new NodeOpaqueTokenService(),
        this.clock,
      );

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
        this.localDevelopmentPasskeyEnrollmentService,
        this.localDevelopmentTestSessionService,
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
  getFoodSearchController(): FoodSearchController {
    return this.foodSearchController;
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
