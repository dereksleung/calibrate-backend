import { MutationOptions, mutationOptions, useMutation } from "@tanstack/react-query";
import { ApiTransport } from "../transport.js";
import { 
  RequestEmailOtpRequestBodySchema,
  RequestEmailOtpResponseSchema, 
  type RequestEmailOtpRequestBody,
  type RequestEmailOtpResponse, 
} from "@calibrate/api-contracts";

export function requestEmailOtp(
  transport: ApiTransport,
  input: RequestEmailOtpRequestBody,
): Promise<RequestEmailOtpResponse> {
  const body = RequestEmailOtpRequestBodySchema.parse(input);

  return transport.request({
    path: "/auth/email-otp",
    method: "POST",
    body,
    responseBodySchema: RequestEmailOtpResponseSchema,
  });
}

export function getRequestEmailOtpMutationOptions(transport: ApiTransport, options?: MutationOptions<RequestEmailOtpResponse, unknown, string>) {
  return mutationOptions({
    mutationKey: ["requestEmailOtp"],
    mutationFn: (email: string) => requestEmailOtp(transport, { email }),
    ...options,
  });
}

export function useRequestEmailOtp(transport: ApiTransport, options?: MutationOptions<RequestEmailOtpResponse, unknown, string>) {
  return useMutation(getRequestEmailOtpMutationOptions(transport, options));
}