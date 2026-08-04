import { z } from "zod";

import { UserResponseSchema, type UserResponse } from "./user-responses.js";

// Cookie-based sessions are used for web clients, while bearer token-based sessions are used for mobile clients.
// The session transport is determined by the client platform and is included in the response to indicate how the session should be handled.
export const SessionTransportSchema = z.enum(["cookie", "bearer"]);

export const RequestAccountEmailVerificationResponseSchema = z
  .object({
    challengeId: z.uuid(),
    expiresInSeconds: z.number().int().positive(),
    resendAfterSeconds: z.number().int().nonnegative(),
  })
  .strict();

export const VerifyAccountEmailVerificationResponseSchema = z.discriminatedUnion("next", [
  z
    .object({
      next: z.literal("passkey-registration"),
      expiresAt: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      next: z.literal("login-or-recovery"),
      expiresAt: z.iso.datetime(),
    })
    .strict(),
]);

export const ActiveRecoverySecurityStateSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("none") }).strict(),
  z
    .object({
      state: z.enum(["provisional", "promotion-eligible"]),
      restrictionEndsAt: z.iso.datetime(),
    })
    .strict(),
]);

export const SessionRestrictionSecurityStateSchema = z
  .object({
    state: z.literal("restricted"),
    restrictionEndsAt: z.iso.datetime(),
  })
  .strict();

export const AuthSecurityStateSchema = z
  .object({
    activeRecovery: ActiveRecoverySecurityStateSchema,
    sessionRestriction: SessionRestrictionSecurityStateSchema.nullable(),
  })
  .strict();

export const AuthenticatedSessionResponseSchema = z
  .object({
    user: UserResponseSchema,
    sessionTransport: SessionTransportSchema,
    security: AuthSecurityStateSchema.optional(),
  })
  .strict();

export const AccessSessionRequiredErrorResponseSchema = z
  .object({ error: z.literal("ACCESS_SESSION_REQUIRED") })
  .strict();

export const RefreshSessionRequiredErrorResponseSchema = z
  .object({ error: z.literal("REFRESH_SESSION_REQUIRED") })
  .strict();

/** A successful DELETE /auth/session response has no body. */
export const DeleteCurrentSessionResponseSchema = z.null();

export type SessionTransport = z.infer<typeof SessionTransportSchema>;
export type RequestAccountEmailVerificationResponse = z.infer<
  typeof RequestAccountEmailVerificationResponseSchema
>;
export type VerifyAccountEmailVerificationResponse = z.infer<
  typeof VerifyAccountEmailVerificationResponseSchema
>;
export type AuthenticatedSessionResponse = z.infer<typeof AuthenticatedSessionResponseSchema>;
export type AccessSessionRequiredErrorResponse = z.infer<typeof AccessSessionRequiredErrorResponseSchema>;
export type RefreshSessionRequiredErrorResponse = z.infer<typeof RefreshSessionRequiredErrorResponseSchema>;
export type DeleteCurrentSessionResponse = z.infer<typeof DeleteCurrentSessionResponseSchema>;

/** @deprecated Use AuthenticatedSessionResponse or the forthcoming passkey contracts. */
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserResponse;
}
