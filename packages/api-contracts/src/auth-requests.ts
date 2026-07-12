import { z } from "zod";

export const AppPlatformHeaderValueSchema = z.enum(["ios", "android"]);

export const RequestEmailOtpRequestBodySchema = z
  .object({
    email: z.email(),
  })
  .strict();

export const VerifyEmailOtpRequestBodySchema = z
  .object({
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/, "Code must contain exactly six digits"),
  })
  .strict();

/** @deprecated Use RequestEmailOtpRequestBodySchema for passwordless authentication. */
export const LoginRequestBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export type AppPlatformHeaderValue = z.infer<typeof AppPlatformHeaderValueSchema>;
export type RequestEmailOtpRequestBody = z.infer<typeof RequestEmailOtpRequestBodySchema>;
export type VerifyEmailOtpRequestBody = z.infer<typeof VerifyEmailOtpRequestBodySchema>;

/** @deprecated Use RequestEmailOtpRequestBody. */
export type LoginRequestBody = z.infer<typeof LoginRequestBodySchema>;
