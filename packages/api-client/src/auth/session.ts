import { AuthenticatedSessionResponseSchema, type AuthenticatedSessionResponse } from "@calibrate/api-contracts";

import type { ApiTransport } from "../transport.js";

export function getCurrentSession(transport: ApiTransport): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/session", responseBodySchema: AuthenticatedSessionResponseSchema });
}

export function refreshSession(transport: ApiTransport): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/session/refresh", method: "POST", responseBodySchema: AuthenticatedSessionResponseSchema });
}
