import { validate } from "@validation/validation-helpers.js";
import * as z from "zod";

import { BusinessLogicError } from "../errors/business-logic-error.js";

export const UserTierSchema = z.enum(["FREE", "PREMIUM", "LIFETIME"]);

export type UserTierEnumType = z.infer<typeof UserTierSchema>;

export class UserTier {
  private readonly _tier: UserTierEnumType;

  private constructor(tier: UserTierEnumType) {
    this._tier = tier;
  }

  public static from(tier: UserTierEnumType): UserTier {
    const validatedTier = validate(UserTierSchema, tier);
    if (!validatedTier.isValid) {
      throw new BusinessLogicError(`Invalid user tier: ${validatedTier.errors.join(", ")}`);
    }
    return new UserTier(validatedTier.data);
  }

  public get value(): UserTierEnumType {
    return this._tier;
  }

  public is(tier: UserTierEnumType): boolean {
    return this._tier === tier;
  }

  public isSubscribed(): boolean {
    return this._tier === UserTierSchema.enum.PREMIUM || this._tier === UserTierSchema.enum.LIFETIME;
  }
}
