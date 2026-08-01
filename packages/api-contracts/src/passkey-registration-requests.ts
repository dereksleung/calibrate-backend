import { z } from "zod";

const Base64UrlStringSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, "Expected base64url-encoded value");

const AuthenticatorTransportSchema = z.enum([
  "usb",
  "nfc",
  "ble",
  "internal",
  "hybrid",
  "smart-card",
]);

export const AuthenticatorAttestationResponseJSONSchema = z
  .object({
    clientDataJSON: Base64UrlStringSchema,
    attestationObject: Base64UrlStringSchema,
    authenticatorData: Base64UrlStringSchema.optional(),
    transports: z.array(AuthenticatorTransportSchema).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: Base64UrlStringSchema.optional(),
  })
  .strict();

export const RegistrationResponseJSONSchema = z
  .object({
    id: Base64UrlStringSchema,
    rawId: Base64UrlStringSchema,
    response: AuthenticatorAttestationResponseJSONSchema,
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()),
    type: z.literal("public-key"),
  })
  .strict();

export const VerifyPasskeyRegistrationRequestBodySchema = z
  .object({
    credential: RegistrationResponseJSONSchema,
    rememberDevice: z.boolean(),
  })
  .strict();

export type RegistrationResponseJSON = z.infer<typeof RegistrationResponseJSONSchema>;
export type VerifyPasskeyRegistrationRequestBody = z.infer<
  typeof VerifyPasskeyRegistrationRequestBodySchema
>;
