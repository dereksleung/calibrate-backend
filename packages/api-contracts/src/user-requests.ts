import { z } from "zod";

const StrongPasswordSchema = z
  .string()
  .min(8, "Too short")
  .refine((val) => /[A-Z]/.test(val), "Must include an uppercase letter")
  .refine((val) => /[a-z]/.test(val), "Must include a lowercase letter")
  .refine((val) => /[0-9]/.test(val), "Must include a number")
  .refine((val) => /[!@#$%^&*-]/.test(val), "Must include a special character");

/** @deprecated Use RequestSignupEmailVerificationRequestBodySchema for passkey signup. */
export const CreateUserRequestBodySchema = z.object({
  email: z.email(),
  password: StrongPasswordSchema,
});

/** @deprecated Use RequestSignupEmailVerificationRequestBody. */
export type CreateUserRequestBody = z.infer<typeof CreateUserRequestBodySchema>;
