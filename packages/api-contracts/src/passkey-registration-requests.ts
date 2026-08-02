import { z } from "zod";

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
    clientDataJSON: z.base64url(),
    attestationObject: z.base64url(),
    authenticatorData: z.base64url().optional(),
    transports: z.array(AuthenticatorTransportSchema).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: z.base64url().optional(),
  })
  .strict();

export const RegistrationResponseJSONSchema = z
  .object({
    id: z.base64url(),
    rawId: z.base64url(),
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
