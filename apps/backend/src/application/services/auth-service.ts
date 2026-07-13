import {
  AuthenticationError,
  IAccessTokenService,
  IPasswordHasher,
  IUserRepository,
  LoginRequestDto,
  LoginResultDto,
} from "@application";

export interface IAuthService {
  login(props: LoginRequestDto): Promise<LoginResultDto>;
}

export class AuthServiceImpl implements IAuthService {
  constructor(
    private readonly passwordHasher: IPasswordHasher,
    private readonly userRepository: IUserRepository,
    private readonly accessTokenService: IAccessTokenService,
  ) {}

  async login(props: LoginRequestDto): Promise<LoginResultDto> {
    const user = await this.userRepository.findByEmail(props.email);

    if (!user || !user.passwordHash) {
      throw new AuthenticationError("Invalid email or password");
    }

    const isValidPassword = await this.passwordHasher.verify(props.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError("Invalid email or password");
    }

    const accessToken = await this.accessTokenService.issue({ userId: user.id });

    return {
      accessToken: accessToken.token,
      expiresInSeconds: accessToken.expiresInSeconds,
      user,
    };
  }
}
