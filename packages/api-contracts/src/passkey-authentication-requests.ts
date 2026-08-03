import { z } from "zod";

const CredentialPropertiesOutputSchema = z
  .object({
    rk: z.boolean().optional(),
  })
  .strict();

export const AuthenticationExtensionsClientOutputsSchema = z
  .object({
    appid: z.boolean().optional(),
    credProps: CredentialPropertiesOutputSchema.optional(),
    hmacCreateSecret: z.boolean().optional(),
  })
  .strict();

export const AuthenticatorAssertionResponseJSONSchema = z
  .object({
    authenticatorData: z.base64url(),
    clientDataJSON: z.base64url(),
    signature: z.base64url(),
    userHandle: z.base64url().optional(),
  })
  .strict();

export const AuthenticationResponseJSONSchema = z
  .object({
    id: z.base64url(),
    rawId: z.base64url(),
    response: AuthenticatorAssertionResponseJSONSchema,
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: AuthenticationExtensionsClientOutputsSchema,
    type: z.literal("public-key"),
  })
  .strict();

export const VerifyPasskeyAuthenticationRequestBodySchema = z
  .object({
    credential: AuthenticationResponseJSONSchema,
    rememberDevice: z.boolean(),
  })
  .strict();

export type AuthenticationResponseJSON = z.infer<typeof AuthenticationResponseJSONSchema>;
export type VerifyPasskeyAuthenticationRequestBody = z.infer<
  typeof VerifyPasskeyAuthenticationRequestBodySchema
>;
