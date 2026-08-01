import { z } from "zod";

export const PasskeyRegistrationErrorCodeSchema = z.enum([
  "ORIGIN_NOT_ALLOWED",
  "ENROLLMENT_AUTHORIZATION_REQUIRED",
  "PASSKEY_REGISTRATION_FAILED",
  "PASSKEY_REGISTRATION_STATE_CONFLICT",
  "PASSKEY_REGISTRATION_RATE_LIMITED",
  "PASSKEY_REGISTRATION_UNAVAILABLE",
]);

export const PasskeyRegistrationErrorResponseSchema = z
  .object({
    error: PasskeyRegistrationErrorCodeSchema,
  })
  .strict();

/**
 * Minimal validation for WebAuthn registration options returned by the backend.
 * Full shape is owned by SimpleWebAuthn; the client only needs a challenge-bearing object.
 */
export const PasskeyRegistrationOptionsResponseSchema = z
  .object({
    challenge: z.string().min(1),
  })
  .passthrough();

export type PasskeyRegistrationErrorCode = z.infer<typeof PasskeyRegistrationErrorCodeSchema>;
export type PasskeyRegistrationErrorResponse = z.infer<typeof PasskeyRegistrationErrorResponseSchema>;
export type PasskeyRegistrationOptionsResponse = z.infer<
  typeof PasskeyRegistrationOptionsResponseSchema
>;
