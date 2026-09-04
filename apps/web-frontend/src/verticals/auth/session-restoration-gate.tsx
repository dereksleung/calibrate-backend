import type { AuthenticatedSessionResponse } from "@calibrate/api-contracts";

import { apiTransport } from "#/shared/api/api-client.ts";
import { Button } from "#/shared/components/base/Button.tsx";
import { WarningBanner } from "#/shared/components/base/WarningBanner.tsx";
import { getCurrentSession, refreshSession, ApiError } from "@calibrate/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  broadcastDayLogCacheRevocation,
  revokeLastConfirmedDayLogCache,
} from "../day-log-cache/indexed-db-day-log-cache.ts";
import {
  PrivateDayLogCacheProvider,
  clearPrivateDayLogMemory,
} from "../day-log-cache/private-day-log-cache-provider.tsx";
import { clearAuthenticatedSession, setAuthenticatedSession } from "./authenticated-session.ts";

type State = "checking" | "refreshing" | "available" | "unavailable";

export function SessionRestorationGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [session, setSession] = useState<AuthenticatedSessionResponse>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const restore = useCallback(async () => {
    setState("checking");
    try {
      const confirmedSession = await getCurrentSession(apiTransport);
      setAuthenticatedSession(queryClient, confirmedSession);
      setSession(confirmedSession);
      setState("available");
      return;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        setState("unavailable");
        return;
      }
    }
    setState("refreshing");
    try {
      await refreshSession(apiTransport);
      const confirmedSession = await getCurrentSession(apiTransport);
      setAuthenticatedSession(queryClient, confirmedSession);
      setSession(confirmedSession);
      setState("available");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const revocation = await revokeLastConfirmedDayLogCache();
        broadcastDayLogCacheRevocation(revocation);
        await clearPrivateDayLogMemory(queryClient);
        clearAuthenticatedSession(queryClient);
        setSession(undefined);
        await navigate({ to: "/signup-login" });
        return;
      }
      setState("unavailable");
    }
  }, [navigate, queryClient]);

  useEffect(() => {
    void restore();
  }, [restore]);
  if (state === "available" && session) {
    return <PrivateDayLogCacheProvider accountId={session.user.id}>{children}</PrivateDayLogCacheProvider>;
  }
  if (state === "unavailable") {
    return (
      <main className="flex min-h-dvh w-screen items-center justify-center">
        <div className="space-y-md">
          <WarningBanner>Calibrate is temporarily unavailable.</WarningBanner>
          <Button className="w-full" onClick={() => void restore()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  return (
    <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <p role="status">Loading your user...</p>
    </main>
  );
}
