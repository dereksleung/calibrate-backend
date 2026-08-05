import {
  AccountAccessStatusResponseSchema,
  AccountRecoveryErrorResponseSchema,
  AuthenticatedSessionResponseSchema,
  AuthorizeRecoveryRegistrationRequestBodySchema,
  AuthorizeRecoveryRegistrationResponseSchema,
  PasskeyAuthenticationOptionsResponseSchema,
  PasskeyRegistrationOptionsResponseSchema,
  RecoveryStatusResponseSchema,
  VerifyPasskeyAuthenticationRequestBodySchema,
  VerifyPasskeyRegistrationRequestBodySchema,
  type AccountAccessStatusResponse,
  type AuthenticatedSessionResponse,
  type AuthorizeRecoveryRegistrationRequestBody,
  type VerifyPasskeyAuthenticationRequestBody,
  type VerifyPasskeyRegistrationRequestBody,
} from "@calibrate/api-contracts";

import { ApiError } from "../errors.js";
import type { ApiTransport } from "../transport.js";

export function getAccountAccessStatus(transport: ApiTransport): Promise<AccountAccessStatusResponse> {
  return transport.request({ path: "/auth/account-access", responseBodySchema: AccountAccessStatusResponseSchema });
}

export function requestIdentifiedPasskeyOptions(transport: ApiTransport) {
  return transport.request({ path: "/auth/account-access/passkeys/authentication/options", method: "POST", responseBodySchema: PasskeyAuthenticationOptionsResponseSchema });
}

export function verifyIdentifiedPasskey(transport: ApiTransport, input: VerifyPasskeyAuthenticationRequestBody): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/account-access/passkeys/authentication/verify", method: "POST", body: VerifyPasskeyAuthenticationRequestBodySchema.parse(input), responseBodySchema: AuthenticatedSessionResponseSchema });
}

export function authorizeRecoveryRegistration(transport: ApiTransport, input: AuthorizeRecoveryRegistrationRequestBody) {
  return transport.request({ path: "/auth/account-access/recovery", method: "POST", body: AuthorizeRecoveryRegistrationRequestBodySchema.parse(input), responseBodySchema: AuthorizeRecoveryRegistrationResponseSchema });
}

export function requestRecoveryRegistrationOptions(transport: ApiTransport) {
  return transport.request({ path: "/auth/recovery/passkeys/registration/options", method: "POST", responseBodySchema: PasskeyRegistrationOptionsResponseSchema });
}

export function verifyRecoveryRegistration(transport: ApiTransport, input: VerifyPasskeyRegistrationRequestBody): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/recovery/passkeys/registration/verify", method: "POST", body: VerifyPasskeyRegistrationRequestBodySchema.parse(input), responseBodySchema: AuthenticatedSessionResponseSchema });
}

export function getRecoveryStatus(transport: ApiTransport) {
  return transport.request({ path: "/auth/recovery/status", responseBodySchema: RecoveryStatusResponseSchema });
}

export function requestRecoveryPromotionOptions(transport: ApiTransport) {
  return transport.request({ path: "/auth/recovery/promotion/options", method: "POST", responseBodySchema: PasskeyAuthenticationOptionsResponseSchema });
}

export function verifyRecoveryPromotion(transport: ApiTransport, input: VerifyPasskeyAuthenticationRequestBody): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/recovery/promotion/verify", method: "POST", body: VerifyPasskeyAuthenticationRequestBodySchema.parse(input), responseBodySchema: AuthenticatedSessionResponseSchema });
}

export function parseAccountRecoveryError(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const parsed = AccountRecoveryErrorResponseSchema.safeParse(error.body);
  return parsed.success ? parsed.data.error : null;
}
