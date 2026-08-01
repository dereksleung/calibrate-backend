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

export type PasskeyRegistrationErrorCode = z.infer<typeof PasskeyRegistrationErrorCodeSchema>;
export type PasskeyRegistrationErrorResponse = z.infer<typeof PasskeyRegistrationErrorResponseSchema>;
