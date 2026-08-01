import type { AuthenticatedSessionResponse } from "@calibrate/api-contracts";
import type { QueryClient } from "@tanstack/react-query";

export const authenticatedSessionQueryKey = ["authenticatedSession"] as const;

export function setAuthenticatedSession(
  queryClient: QueryClient,
  session: AuthenticatedSessionResponse,
): void {
  queryClient.setQueryData(authenticatedSessionQueryKey, session);
}

export function getAuthenticatedSession(
  queryClient: QueryClient,
): AuthenticatedSessionResponse | undefined {
  return queryClient.getQueryData(authenticatedSessionQueryKey);
}
