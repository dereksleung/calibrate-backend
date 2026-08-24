import { apiTransport } from "#/shared/api/api-client.ts";
import { restoreDayLogCache } from "#/shared/api/day-log-cache.ts";
import { Button } from "#/shared/components/base/Button.tsx";
import { WarningBanner } from "#/shared/components/base/WarningBanner.tsx";
import { getCurrentSession, refreshSession, ApiError } from "@calibrate/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthenticatedSession, setAuthenticatedSession } from "./authenticated-session.ts";

type State = "checking" | "refreshing" | "available" | "unavailable";
type IsCurrentOperation = () => boolean;

export function SessionRestorationGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mountedRef = useRef(false);
  const restoreOperationRef = useRef(0);
  const restoreConfirmedSession = useCallback(
    async (
      session: Awaited<ReturnType<typeof getCurrentSession>>,
      isCurrentOperation: IsCurrentOperation,
    ) => {
      if (!isCurrentOperation()) return false;
      setAuthenticatedSession(queryClient, session);
      await restoreDayLogCache(queryClient, session.user.id, {
        isCurrentUser: () =>
          isCurrentOperation() && getAuthenticatedSession(queryClient)?.user.id === session.user.id,
      });
      return isCurrentOperation() && getAuthenticatedSession(queryClient)?.user.id === session.user.id;
    },
    [queryClient],
  );
  const restore = useCallback(async () => {
    const operation = restoreOperationRef.current + 1;
    restoreOperationRef.current = operation;
    const isCurrentOperation = () =>
      mountedRef.current && restoreOperationRef.current === operation;
    if (!isCurrentOperation()) return;

    setState("checking");
    try {
      const session = await getCurrentSession(apiTransport);
      if (
        !isCurrentOperation() ||
        !(await restoreConfirmedSession(session, isCurrentOperation))
      ) {
        return;
      }
      setState("available");
      return;
    } catch (error) {
      if (!isCurrentOperation()) return;
      if (!(error instanceof ApiError) || error.status !== 401) {
        setState("unavailable");
        return;
      }
    }
    if (!isCurrentOperation()) return;
    setState("refreshing");
    try {
      await refreshSession(apiTransport);
      if (!isCurrentOperation()) return;
      const session = await getCurrentSession(apiTransport);
      if (
        !isCurrentOperation() ||
        !(await restoreConfirmedSession(session, isCurrentOperation))
      ) {
        return;
      }
      setState("available");
    } catch (error) {
      if (!isCurrentOperation()) return;
      if (error instanceof ApiError && error.status === 401) {
        queryClient.removeQueries({ queryKey: ["authenticatedSession"] });
        await navigate({ to: "/signup-login" });
        return;
      }
      setState("unavailable");
    }
  }, [navigate, restoreConfirmedSession, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    void restore();
    return () => {
      mountedRef.current = false;
      restoreOperationRef.current += 1;
    };
  }, [restore]);
  if (state === "available") return <>{children}</>;
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
