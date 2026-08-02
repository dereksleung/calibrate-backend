import { z } from "zod";

export const PasskeyAuthenticationErrorCodeSchema = z.enum([
  "PASSKEY_AUTHENTICATION_FAILED",
  "ORIGIN_NOT_ALLOWED",
  "PASSKEY_AUTHENTICATION_STATE_CONFLICT",
  "PASSKEY_AUTHENTICATION_RATE_LIMITED",
  "PASSKEY_AUTHENTICATION_UNAVAILABLE",
]);

export const PasskeyAuthenticationErrorResponseSchema = z
  .object({
    error: PasskeyAuthenticationErrorCodeSchema,
  })
  .strict();

export const PasskeyAuthenticationOptionsResponseSchema = z
  .object({
    options: z
      .object({
        challenge: z.string().min(1),
        rpId: z.string().min(1),
        timeout: z.literal(300_000),
        userVerification: z.literal("required"),
      })
      .strict(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export type PasskeyAuthenticationErrorCode = z.infer<typeof PasskeyAuthenticationErrorCodeSchema>;
export type PasskeyAuthenticationErrorResponse = z.infer<
  typeof PasskeyAuthenticationErrorResponseSchema
>;
export type PasskeyAuthenticationOptionsResponse = z.infer<
  typeof PasskeyAuthenticationOptionsResponseSchema
>;
