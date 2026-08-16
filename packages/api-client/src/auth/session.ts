import {
  AuthenticatedSessionResponseSchema,
  DeleteCurrentSessionResponseSchema,
  type AuthenticatedSessionResponse,
  type DeleteCurrentSessionResponse,
} from "@calibrate/api-contracts";

import type { ApiTransport } from "../transport.js";

export function getCurrentSession(transport: ApiTransport): Promise<AuthenticatedSessionResponse> {
  return transport.request({ path: "/auth/session", responseBodySchema: AuthenticatedSessionResponseSchema });
}

export function refreshSession(transport: ApiTransport): Promise<AuthenticatedSessionResponse> {
  return transport.request({
    path: "/auth/session/refresh",
    method: "POST",
    responseBodySchema: AuthenticatedSessionResponseSchema,
  });
}

export function startLocalDevelopmentTestSession(
  transport: ApiTransport,
): Promise<AuthenticatedSessionResponse> {
  return transport.request({
    path: "/auth/local-development/test-session",
    method: "POST",
    responseBodySchema: AuthenticatedSessionResponseSchema,
  });
}

export function deleteCurrentSession(transport: ApiTransport): Promise<DeleteCurrentSessionResponse> {
  return transport.request({
    path: "/auth/session",
    method: "DELETE",
    responseBodySchema: DeleteCurrentSessionResponseSchema,
  });
}
