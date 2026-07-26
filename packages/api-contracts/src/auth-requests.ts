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

/** @deprecated Use RequestSignupEmailVerificationRequestBodySchema. */
export const RequestEmailOtpRequestBodySchema =
  RequestSignupEmailVerificationRequestBodySchema;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export const VerifyEmailOtpRequestBodySchema = z
  .object({
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/, "Code must contain exactly six digits"),
  })
  .strict();

/** @deprecated Use RequestSignupEmailVerificationRequestBody. */
export type RequestEmailOtpRequestBody = RequestSignupEmailVerificationRequestBody;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export type VerifyEmailOtpRequestBody = z.infer<typeof VerifyEmailOtpRequestBodySchema>;

/** @deprecated Use passkey authentication contracts when they are available. */
export type LoginRequestBody = z.infer<typeof LoginRequestBodySchema>;
