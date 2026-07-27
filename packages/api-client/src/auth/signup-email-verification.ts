import {
  RequestSignupEmailVerificationRequestBodySchema,
  RequestSignupEmailVerificationResponseSchema,
  type RequestSignupEmailVerificationRequestBody,
  type RequestSignupEmailVerificationResponse,
} from "@calibrate/api-contracts";
import { MutationOptions, mutationOptions, useMutation } from "@tanstack/react-query";

import { ApiTransport } from "../transport.js";

export function requestSignupEmailVerification(
  transport: ApiTransport,
  input: RequestSignupEmailVerificationRequestBody,
): Promise<RequestSignupEmailVerificationResponse> {
  const body = RequestSignupEmailVerificationRequestBodySchema.parse(input);

  return transport.request({
    path: "/auth/email-verification",
    method: "POST",
    body,
    responseBodySchema: RequestSignupEmailVerificationResponseSchema,
  });
}

export function getRequestSignupEmailVerificationMutationOptions(
  transport: ApiTransport,
  options?: MutationOptions<RequestSignupEmailVerificationResponse, unknown, string>,
) {
  return mutationOptions({
    mutationKey: ["requestSignupEmailVerification"],
    mutationFn: (email: string) => requestSignupEmailVerification(transport, { email }),
    ...options,
  });
}

export function useRequestSignupEmailVerification(
  transport: ApiTransport,
  options?: MutationOptions<RequestSignupEmailVerificationResponse, unknown, string>,
) {
  return useMutation(getRequestSignupEmailVerificationMutationOptions(transport, options));
}
