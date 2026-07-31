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

export const VerifySignupEmailVerificationResponseSchema = z
  .object({
    next: z.literal("passkey-registration"),
    expiresAt: z.iso.datetime(),
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
export type VerifySignupEmailVerificationResponse = z.infer<
  typeof VerifySignupEmailVerificationResponseSchema
>;
export type AuthenticatedSessionResponse = z.infer<typeof AuthenticatedSessionResponseSchema>;

/** @deprecated Use AuthenticatedSessionResponse or the forthcoming passkey contracts. */
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserResponse;
}
