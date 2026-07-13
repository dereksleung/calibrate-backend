import {
  IAccessTokenService,
  IDayLogRepository,
  IPasswordHasher,
  IAuthService,
  IEmailOtpService,
  IUserRepository,
  IUserService,
} from "@application";
import { AuthController, DayLogController, UserController } from "@controllers";
import {
  AuthServiceImpl,
  IDayLogService,
  DayLogServiceImpl,
  UnavailableEmailOtpService,
  UserServiceImpl,
} from "@services";

import { PostgresDayLogRepository, PostgresUserRepository } from "./persistence/repositories/index.js";
import { Argon2PasswordHasher, JoseAccessTokenService } from "./security/index.js";

export class Container {
  private readonly accessTokenService: IAccessTokenService;
  private readonly authController: AuthController;
  private readonly authService: IAuthService;
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
    emailOtpService,
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
    emailOtpService?: IEmailOtpService;
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
    this.emailOtpService = emailOtpService ?? new UnavailableEmailOtpService();
    this.authController = authController ?? new AuthController(this.authService, this.emailOtpService);
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
