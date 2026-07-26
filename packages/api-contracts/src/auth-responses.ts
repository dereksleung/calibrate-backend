import { z } from "zod";

import { UserResponseSchema, type UserResponse } from "./user-responses.js";

// Cookie-based sessions are used for web clients, while bearer token-based sessions are used for mobile clients. 
// The session transport is determined by the client platform and is included in the response to indicate how the session should be handled.
export const SessionTransportSchema = z.enum(["cookie", "bearer"]);

export const RequestSignupEmailVerificationResponseSchema = z
  .object({
    challengeId: z.uuid(),
    expiresInSeconds: z.number().int().positive(),
    resendAfterSeconds: z.number().int().nonnegative(),
  })
  .strict();

export const AuthenticatedSessionResponseSchema = z
  .object({
    user: UserResponseSchema,
    sessionTransport: SessionTransportSchema,
  })
  .strict();

export type SessionTransport = z.infer<typeof SessionTransportSchema>;
export type RequestSignupEmailVerificationResponse = z.infer<
  typeof RequestSignupEmailVerificationResponseSchema
>;
export type AuthenticatedSessionResponse = z.infer<typeof AuthenticatedSessionResponseSchema>;

/** @deprecated Use RequestSignupEmailVerificationResponseSchema. */
export const RequestEmailOtpResponseSchema = RequestSignupEmailVerificationResponseSchema;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export const WebVerifyEmailOtpResponseSchema = z
  .object({
    sessionTransport: z.literal("cookie"),
    user: UserResponseSchema,
  })
  .strict();

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export const MobileVerifyEmailOtpResponseSchema = z
  .object({
    sessionTransport: z.literal("bearer"),
    user: UserResponseSchema,
    sessionToken: z.string().min(43).max(512),
    expiresAt: z.string().datetime(),
  })
  .strict();

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export const VerifyEmailOtpResponseSchema = z.discriminatedUnion("sessionTransport", [
  WebVerifyEmailOtpResponseSchema,
  MobileVerifyEmailOtpResponseSchema,
]);

/** @deprecated Use RequestSignupEmailVerificationResponse. */
export type RequestEmailOtpResponse = RequestSignupEmailVerificationResponse;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export type WebVerifyEmailOtpResponse = z.infer<typeof WebVerifyEmailOtpResponseSchema>;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export type MobileVerifyEmailOtpResponse = z.infer<typeof MobileVerifyEmailOtpResponseSchema>;

/** @deprecated The email-OTP authentication verification endpoint is being retired. */
export type VerifyEmailOtpResponse = z.infer<typeof VerifyEmailOtpResponseSchema>;

/** @deprecated Use AuthenticatedSessionResponse or the forthcoming passkey contracts. */
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserResponse;
}
