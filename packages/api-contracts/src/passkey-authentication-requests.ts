import { z } from "zod";

const Base64UrlStringSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, "Expected base64url-encoded value");

export const AuthenticatorAssertionResponseJSONSchema = z
  .object({
    authenticatorData: Base64UrlStringSchema,
    clientDataJSON: Base64UrlStringSchema,
    signature: Base64UrlStringSchema,
    userHandle: Base64UrlStringSchema.optional(),
  })
  .strict();

export const AuthenticationResponseJSONSchema = z
  .object({
    id: Base64UrlStringSchema,
    rawId: Base64UrlStringSchema,
    response: AuthenticatorAssertionResponseJSONSchema,
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()),
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
