import { CreateUserRequestDto, IPasswordHasher, IUserRepository } from "@application";
import { User } from "@domain/entities/user.js";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";

export interface IUserService {
  createUser(props: CreateUserRequestDto): Promise<User>;
}

export class UserServiceImpl implements IUserService {
  constructor(
    private readonly passwordHasher: IPasswordHasher,
    private readonly userRepository: IUserRepository,
  ) {}

  async createUser(props: CreateUserRequestDto): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(props.email);
    if (existingUser) {
      throw new BusinessLogicError("User already exists");
    }
    const passwordHash = await this.passwordHasher.hash(props.password);
    const user = User.create({ email: props.email, passwordHash });
    const persistedUser = await this.userRepository.save(user);
    return persistedUser;
  }
}
