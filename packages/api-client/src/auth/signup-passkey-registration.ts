import {
  AuthenticatedSessionResponseSchema,
  PasskeyRegistrationErrorResponseSchema,
  PasskeyRegistrationOptionsResponseSchema,
  VerifyPasskeyRegistrationRequestBodySchema,
  type AuthenticatedSessionResponse,
  type PasskeyRegistrationErrorCode,
  type PasskeyRegistrationOptionsResponse,
  type VerifyPasskeyRegistrationRequestBody,
} from "@calibrate/api-contracts";
import { MutationOptions, mutationOptions, useMutation } from "@tanstack/react-query";

import { ApiError } from "../errors.js";
import { ApiTransport } from "../transport.js";

export function requestPasskeyRegistrationOptions(
  transport: ApiTransport,
): Promise<PasskeyRegistrationOptionsResponse> {
  return transport.request({
    path: "/auth/passkeys/registration/options",
    method: "POST",
    responseBodySchema: PasskeyRegistrationOptionsResponseSchema,
  });
}

export function verifyPasskeyRegistration(
  transport: ApiTransport,
  input: VerifyPasskeyRegistrationRequestBody,
): Promise<AuthenticatedSessionResponse> {
  const body = VerifyPasskeyRegistrationRequestBodySchema.parse(input);

  return transport.request({
    path: "/auth/passkeys/registration/verify",
    method: "POST",
    body,
    responseBodySchema: AuthenticatedSessionResponseSchema,
  });
}

export function parsePasskeyRegistrationError(error: unknown): PasskeyRegistrationErrorCode | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const parsed = PasskeyRegistrationErrorResponseSchema.safeParse(error.body);
  return parsed.success ? parsed.data.error : null;
}

export function getRequestPasskeyRegistrationOptionsMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<PasskeyRegistrationOptionsResponse, unknown, void>,
) {
  return mutationOptions({
    mutationKey: ["requestPasskeyRegistrationOptions"],
    mutationFn: () => requestPasskeyRegistrationOptions(transport),
    ...options,
  });
}

export function getVerifyPasskeyRegistrationMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<
    AuthenticatedSessionResponse,
    unknown,
    VerifyPasskeyRegistrationRequestBody
  >,
) {
  return mutationOptions({
    mutationKey: ["verifyPasskeyRegistration"],
    mutationFn: (input: VerifyPasskeyRegistrationRequestBody) =>
      verifyPasskeyRegistration(transport, input),
    retry: false,
    ...options,
  });
}

export function useRequestPasskeyRegistrationOptions(
  transport: ApiTransport,
  options?: MutationOptions<PasskeyRegistrationOptionsResponse, unknown, void>,
) {
  return useMutation(getRequestPasskeyRegistrationOptionsMutationOptions(transport, options));
}

export function useVerifyPasskeyRegistration(
  transport: ApiTransport,
  options?: MutationOptions<
    AuthenticatedSessionResponse,
    unknown,
    VerifyPasskeyRegistrationRequestBody
  >,
) {
  return useMutation(getVerifyPasskeyRegistrationMutationOptions(transport, options));
}
