import type { AuthenticatedSessionResponse } from "@calibrate/api-contracts";

import { skipToken, useQuery, type QueryClient } from "@tanstack/react-query";

export const authenticatedSessionQueryKey = ["authenticatedSession"] as const;

export function setAuthenticatedSession(
  queryClient: QueryClient,
  session: AuthenticatedSessionResponse,
): void {
  queryClient.setQueryData(authenticatedSessionQueryKey, session);
}

export function getAuthenticatedSession(queryClient: QueryClient): AuthenticatedSessionResponse | undefined {
  return queryClient.getQueryData(authenticatedSessionQueryKey);
}

export function clearAuthenticatedSession(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: authenticatedSessionQueryKey });
}

/** Subscribes a component to changes in the data set by the manual methods above */
export function useAuthenticatedSession(): AuthenticatedSessionResponse | undefined {
  const { data } = useQuery({
    queryKey: authenticatedSessionQueryKey,
    queryFn: skipToken,
    staleTime: Infinity,
  });
  return data as AuthenticatedSessionResponse | undefined;
}
