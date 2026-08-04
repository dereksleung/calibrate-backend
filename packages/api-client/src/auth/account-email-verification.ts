import {
  RequestAccountEmailVerificationRequestBodySchema,
  RequestAccountEmailVerificationResponseSchema,
  VerifyAccountEmailVerificationRequestBodySchema,
  VerifyAccountEmailVerificationResponseSchema,
  type RequestAccountEmailVerificationRequestBody,
  type RequestAccountEmailVerificationResponse,
  type VerifyAccountEmailVerificationRequestBody,
  type VerifyAccountEmailVerificationResponse,
} from "@calibrate/api-contracts";
import { MutationOptions, mutationOptions, useMutation } from "@tanstack/react-query";

import { ApiTransport } from "../transport.js";

export function requestAccountEmailVerification(
  transport: ApiTransport,
  input: RequestAccountEmailVerificationRequestBody,
): Promise<RequestAccountEmailVerificationResponse> {
  const body = RequestAccountEmailVerificationRequestBodySchema.parse(input);

  return transport.request({
    path: "/auth/email-verification",
    method: "POST",
    body,
    responseBodySchema: RequestAccountEmailVerificationResponseSchema,
  });
}

export function verifyAccountEmailVerification(
  transport: ApiTransport,
  input: VerifyAccountEmailVerificationRequestBody,
): Promise<VerifyAccountEmailVerificationResponse> {
  const body = VerifyAccountEmailVerificationRequestBodySchema.parse(input);

  return transport.request({
    path: "/auth/email-verification/verify",
    method: "POST",
    body,
    responseBodySchema: VerifyAccountEmailVerificationResponseSchema,
  });
}

export function getRequestAccountEmailVerificationMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<RequestAccountEmailVerificationResponse, unknown, string>,
) {
  return mutationOptions({
    mutationKey: ["requestAccountEmailVerification"],
    mutationFn: (email: string) => requestAccountEmailVerification(transport, { email }),
    ...options,
  });
}

export function useRequestAccountEmailVerification(
  transport: ApiTransport,
  options?: MutationOptions<RequestAccountEmailVerificationResponse, unknown, string>,
) {
  return useMutation(getRequestAccountEmailVerificationMutationOptions(transport, options));
}

export function useVerifyAccountEmailVerification(
  transport: ApiTransport,
  options?: MutationOptions<
    VerifyAccountEmailVerificationResponse,
    unknown,
    VerifyAccountEmailVerificationRequestBody
  >,
) {
  return useMutation(
    mutationOptions({
      mutationKey: ["verifyAccountEmailVerification"],
      mutationFn: (input: VerifyAccountEmailVerificationRequestBody) =>
        verifyAccountEmailVerification(transport, input),
      retry: false,
      ...options,
    }),
  );
}
