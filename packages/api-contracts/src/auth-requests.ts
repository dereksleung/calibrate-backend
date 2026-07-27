import { z } from "zod";

export const AppPlatformHeaderValueSchema = z.enum(["ios", "android"]);

export const RequestSignupEmailVerificationRequestBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  })
  .strict();

/** @deprecated Use passkey authentication contracts when they are available. */
export const LoginRequestBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export type AppPlatformHeaderValue = z.infer<typeof AppPlatformHeaderValueSchema>;
export type RequestSignupEmailVerificationRequestBody = z.infer<
  typeof RequestSignupEmailVerificationRequestBodySchema
>;

/** @deprecated Use passkey authentication contracts when they are available. */
export type LoginRequestBody = z.infer<typeof LoginRequestBodySchema>;
