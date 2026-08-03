import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import { User } from "@domain/entities/user.js";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  expiresInSeconds: number;
  user: User;
}

export interface IAuthService {
  login(props: LoginInput): Promise<LoginResult>;
}

export class AuthServiceImpl implements IAuthService {
  constructor(
    private readonly passwordHasher: IPasswordHasher,
    private readonly userRepository: IUserRepository,
    private readonly accessTokenService: IAccessTokenService,
  ) {}

  async login(props: LoginInput): Promise<LoginResult> {
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
