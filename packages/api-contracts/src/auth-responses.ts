import { z } from "zod";

import { UserResponseSchema, type UserResponse } from "./user-responses.js";

export const SessionTransportSchema = z.enum(["cookie", "bearer"]);

export const RequestEmailOtpResponseSchema = z
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

export const WebVerifyEmailOtpResponseSchema = z
  .object({
    user: UserResponseSchema,
    sessionTransport: z.literal("cookie"),
  })
  .strict();

export const MobileVerifyEmailOtpResponseSchema = z
  .object({
    user: UserResponseSchema,
    sessionTransport: z.literal("bearer"),
    sessionToken: z.string().min(43).max(512),
    expiresAt: z.coerce.date(),
  })
  .strict();

export const VerifyEmailOtpResponseSchema = z.discriminatedUnion("sessionTransport", [
  WebVerifyEmailOtpResponseSchema,
  MobileVerifyEmailOtpResponseSchema,
]);

export type SessionTransport = z.infer<typeof SessionTransportSchema>;
export type RequestEmailOtpResponse = z.infer<typeof RequestEmailOtpResponseSchema>;
export type AuthenticatedSessionResponse = z.infer<typeof AuthenticatedSessionResponseSchema>;
export type WebVerifyEmailOtpResponse = z.infer<typeof WebVerifyEmailOtpResponseSchema>;
export type MobileVerifyEmailOtpResponse = z.infer<typeof MobileVerifyEmailOtpResponseSchema>;
export type VerifyEmailOtpResponse = z.infer<typeof VerifyEmailOtpResponseSchema>;

/** @deprecated Use VerifyEmailOtpResponse or AuthenticatedSessionResponse. */
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserResponse;
}
