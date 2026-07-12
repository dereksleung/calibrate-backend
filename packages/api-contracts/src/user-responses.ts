import * as z from "zod";

export const UserTierSchema = z.enum(["FREE", "PREMIUM", "LIFETIME"]);

export const UserResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  tier: UserTierSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserTierEnumType = z.infer<typeof UserTierSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
