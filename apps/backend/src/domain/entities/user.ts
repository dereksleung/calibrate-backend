import { UserTier, UserTierEnumType, UserTierSchema } from "../value-objects/user-tier.js";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt?: Date | null;
  tier: UserTierEnumType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProps {
  email: string;
  passwordHash: string;
}

export class User {
  private readonly _id: string;
  private readonly _email: string;
  private readonly _passwordHash: string | null;
  private readonly _emailVerifiedAt: Date | null;
  private readonly _tier: UserTier;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor({ id, email, passwordHash, emailVerifiedAt, tier, createdAt, updatedAt }: UserProps) {
    this._id = id;
    this._email = email;
    this._passwordHash = passwordHash;
    this._emailVerifiedAt = emailVerifiedAt ?? null;
    this._tier = UserTier.from(tier);
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }
  public static create(props: CreateUserProps): User {
    return new User({
      id: crypto.randomUUID(),
      email: props.email,
      passwordHash: props.passwordHash,
      emailVerifiedAt: null,
      tier: UserTierSchema.enum.FREE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public get id(): string {
    return this._id;
  }
  public get email(): string {
    return this._email;
  }
  public get passwordHash(): string | null {
    return this._passwordHash;
  }
  public get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }
  public get tier(): UserTier {
    return this._tier;
  }
  public get createdAt(): Date {
    return this._createdAt;
  }
  public get updatedAt(): Date {
    return this._updatedAt;
  }
}
