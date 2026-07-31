import { LoginRequestDto, LoginResultDto } from "@application/dtos/auth-dtos.js";
import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";

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
