import { z } from "zod";

export const AppPlatformHeaderValueSchema = z.enum(["ios", "android"]);

export const RequestAccountEmailVerificationRequestBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  })
  .strict();

export const VerifyAccountEmailVerificationRequestBodySchema = z
  .object({
    challengeId: z.uuid(),
    code: z.string().regex(/^[0-9]{6}$/),
  })
  .strict();

/** @deprecated Use passkey authentication contracts when they are available. */
export const LoginRequestBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export type AppPlatformHeaderValue = z.infer<typeof AppPlatformHeaderValueSchema>;
export type RequestAccountEmailVerificationRequestBody = z.infer<
  typeof RequestAccountEmailVerificationRequestBodySchema
>;
export type VerifyAccountEmailVerificationRequestBody = z.infer<
  typeof VerifyAccountEmailVerificationRequestBodySchema
>;

/** @deprecated Use passkey authentication contracts when they are available. */
export type LoginRequestBody = z.infer<typeof LoginRequestBodySchema>;
