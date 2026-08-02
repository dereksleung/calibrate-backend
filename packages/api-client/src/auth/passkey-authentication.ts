import {
  AuthenticatedSessionResponseSchema,
  PasskeyAuthenticationErrorResponseSchema,
  PasskeyAuthenticationOptionsResponseSchema,
  VerifyPasskeyAuthenticationRequestBodySchema,
  type AuthenticatedSessionResponse,
  type PasskeyAuthenticationErrorCode,
  type PasskeyAuthenticationOptionsResponse,
  type VerifyPasskeyAuthenticationRequestBody,
} from "@calibrate/api-contracts";
import { type MutationOptions, mutationOptions, useMutation } from "@tanstack/react-query";

import { ApiError } from "../errors.js";
import type { ApiTransport } from "../transport.js";

export function requestPasskeyAuthenticationOptions(
  transport: ApiTransport,
): Promise<PasskeyAuthenticationOptionsResponse> {
  return transport.request({
    path: "/auth/passkeys/authentication/options",
    method: "POST",
    responseBodySchema: PasskeyAuthenticationOptionsResponseSchema,
  });
}

export function verifyPasskeyAuthentication(
  transport: ApiTransport,
  input: VerifyPasskeyAuthenticationRequestBody,
): Promise<AuthenticatedSessionResponse> {
  const body = VerifyPasskeyAuthenticationRequestBodySchema.parse(input);
  return transport.request({
    path: "/auth/passkeys/authentication/verify",
    method: "POST",
    body,
    responseBodySchema: AuthenticatedSessionResponseSchema,
  });
}

export function parsePasskeyAuthenticationError(error: unknown): PasskeyAuthenticationErrorCode | null {
  if (!(error instanceof ApiError)) return null;
  const parsed = PasskeyAuthenticationErrorResponseSchema.safeParse(error.body);
  return parsed.success ? parsed.data.error : null;
}

export function getRequestPasskeyAuthenticationOptionsMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<PasskeyAuthenticationOptionsResponse, unknown, void>,
) {
  return mutationOptions({
    mutationKey: ["requestPasskeyAuthenticationOptions"],
    mutationFn: () => requestPasskeyAuthenticationOptions(transport),
    retry: false,
    ...options,
  });
}

export function getVerifyPasskeyAuthenticationMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<AuthenticatedSessionResponse, unknown, VerifyPasskeyAuthenticationRequestBody>,
) {
  return mutationOptions({
    mutationKey: ["verifyPasskeyAuthentication"],
    mutationFn: (input: VerifyPasskeyAuthenticationRequestBody) => verifyPasskeyAuthentication(transport, input),
    retry: false,
    ...options,
  });
}

export function useRequestPasskeyAuthenticationOptions(
  transport: ApiTransport,
  options?: MutationOptions<PasskeyAuthenticationOptionsResponse, unknown, void>,
) {
  return useMutation(getRequestPasskeyAuthenticationOptionsMutationOptions(transport, options));
}

export function useVerifyPasskeyAuthentication(
  transport: ApiTransport,
  options?: MutationOptions<AuthenticatedSessionResponse, unknown, VerifyPasskeyAuthenticationRequestBody>,
) {
  return useMutation(getVerifyPasskeyAuthenticationMutationOptions(transport, options));
}
