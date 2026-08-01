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

const AuthenticatorTransportSchema = z.enum(["usb", "nfc", "ble", "internal", "hybrid", "smart-card"]);

const AuthenticatorSelectionSchema = z
  .object({
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    requireResidentKey: z.boolean().optional(),
    residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
    userVerification: z.enum(["discouraged", "preferred", "required"]).optional(),
  })
  .strict();

export const PasskeyRegistrationOptionsResponseSchema = z
  .object({
    challenge: z.string().min(1),
    rp: z
      .object({
        name: z.string().min(1),
        id: z.string().min(1).optional(),
      })
      .strict(),
    user: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        displayName: z.string().min(1),
      })
      .strict(),
    pubKeyCredParams: z
      .array(
        z
          .object({
            type: z.literal("public-key"),
            alg: z.number().int(),
          })
          .strict(),
      )
      .min(1),
    timeout: z.number().int().positive().optional(),
    excludeCredentials: z
      .array(
        z
          .object({
            id: z.string().min(1),
            type: z.literal("public-key"),
            transports: z.array(AuthenticatorTransportSchema).optional(),
          })
          .strict(),
      )
      .optional(),
    authenticatorSelection: AuthenticatorSelectionSchema.optional(),
    hints: z.array(z.enum(["security-key", "client-device", "hybrid"])).optional(),
    attestation: z.enum(["none", "indirect", "direct", "enterprise"]).optional(),
    extensions: z
      .object({
        appid: z.string().optional(),
        credProps: z.boolean().optional(),
        hmacCreateSecret: z.boolean().optional(),
        minPinLength: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PasskeyRegistrationErrorCode = z.infer<typeof PasskeyRegistrationErrorCodeSchema>;
export type PasskeyRegistrationErrorResponse = z.infer<typeof PasskeyRegistrationErrorResponseSchema>;
export type PasskeyRegistrationOptionsResponse = z.infer<typeof PasskeyRegistrationOptionsResponseSchema>;
