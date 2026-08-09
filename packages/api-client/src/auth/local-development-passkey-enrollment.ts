import {
  LocalDevelopmentPasskeyEnrollmentResponseSchema,
  type LocalDevelopmentPasskeyEnrollmentResponse,
} from "@calibrate/api-contracts";

import { ApiTransport } from "../transport.js";

/** Creates a loopback-only disposable passkey signup authorization. */
export function requestLocalDevelopmentPasskeyEnrollment(
  transport: ApiTransport,
): Promise<LocalDevelopmentPasskeyEnrollmentResponse> {
  return transport.request({
    path: "/auth/local-development/passkey-enrollment",
    method: "POST",
    responseBodySchema: LocalDevelopmentPasskeyEnrollmentResponseSchema,
  });
}
