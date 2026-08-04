import { z } from "zod";

import { ActiveRecoverySecurityStateSchema, AuthSecurityStateSchema } from "./auth-responses.js";

export const AccountAccessStatusResponseSchema = z
  .object({
    email: z.email(),
    hasRegisteredPasskeys: z.boolean(),
    activeRecovery: ActiveRecoverySecurityStateSchema,
    authorizationExpiresAt: z.iso.datetime(),
  })
  .strict();

export const AuthorizeRecoveryRegistrationRequestBodySchema = z
  .object({
    mode: z.enum(["create", "replace-provisional"]),
  })
  .strict();

export const AuthorizeRecoveryRegistrationResponseSchema = z
  .object({
    next: z.literal("recovery-passkey-registration"),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export const RecoveryStatusResponseSchema = AuthSecurityStateSchema;

export const AccountRecoveryErrorCodeSchema = z.enum([
  "ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED",
  "RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED",
  "IDENTIFIED_PASSKEY_AUTHENTICATION_FAILED",
  "RECOVERY_PASSKEY_REGISTRATION_FAILED",
  "RECOVERY_PROMOTION_FAILED",
  "RECOVERY_CANCELLATION_FAILED",
  "RECOVERY_SECURITY_RESTRICTION_ACTIVE",
  "NO_REGISTERED_PASSKEYS",
  "ACCOUNT_ACCESS_STATE_CONFLICT",
  "RECOVERY_ALREADY_ACTIVE",
  "RECOVERY_PROMOTION_NOT_READY",
  "RECOVERY_STATE_CONFLICT",
  "ACCOUNT_RECOVERY_RATE_LIMITED",
  "ACCOUNT_RECOVERY_UNAVAILABLE",
]);

export const AccountRecoveryErrorResponseSchema = z
  .object({ error: AccountRecoveryErrorCodeSchema })
  .strict();

export type AccountAccessStatusResponse = z.infer<typeof AccountAccessStatusResponseSchema>;
export type AuthorizeRecoveryRegistrationRequestBody = z.infer<
  typeof AuthorizeRecoveryRegistrationRequestBodySchema
>;
export type AuthorizeRecoveryRegistrationResponse = z.infer<
  typeof AuthorizeRecoveryRegistrationResponseSchema
>;
export type RecoveryStatusResponse = z.infer<typeof RecoveryStatusResponseSchema>;
export type AccountRecoveryErrorCode = z.infer<typeof AccountRecoveryErrorCodeSchema>;
export type AccountRecoveryErrorResponse = z.infer<typeof AccountRecoveryErrorResponseSchema>;
