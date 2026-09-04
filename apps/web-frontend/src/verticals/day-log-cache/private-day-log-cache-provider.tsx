import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { clearAuthenticatedSession } from "../auth/authenticated-session.ts";
import {
  DAY_LOG_CACHE_BUSTER,
  DAY_LOG_CACHE_RETENTION_MS,
  dayLogSlotQueryKeyPrefix,
  isPersistableDayLogQueryData,
} from "./day-log-cache.ts";
import {
  DAY_LOG_CACHE_BROADCAST_CHANNEL,
  acquireDayLogCacheLease,
  type DayLogCacheLease,
  type DayLogCacheRevocation,
} from "./indexed-db-day-log-cache.ts";

const LIFECYCLE_CHECK_INTERVAL_MS = 15_000;

export async function clearPrivateDayLogMemory(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ["dayLogs"] });
  queryClient.removeQueries({ queryKey: ["dayLogs"] });
}

function isRevocation(value: unknown): value is DayLogCacheRevocation & { type: "revoked" } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DayLogCacheRevocation & { type: "revoked" }>;
  return (
    candidate.type === "revoked" &&
    typeof candidate.accountId === "string" &&
    typeof candidate.generation === "number" &&
    Number.isSafeInteger(candidate.generation) &&
    candidate.generation >= 0
  );
}

function LeasePersistenceBoundary({
  accountId,
  children,
  lease,
}: {
  accountId: string;
  children: React.ReactNode;
  lease: DayLogCacheLease;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [revoked, setRevoked] = useState(false);
  const [restoreCompletion] = useState(() => {
    let complete!: () => void;
    const promise = new Promise<void>((resolve) => {
      complete = resolve;
    });
    return { complete, promise };
  });

  useEffect(() => {
    let active = true;
    let revocationStarted = false;
    let stopLifecycleChecks: (() => void) | undefined;

    const purgeRevokedSession = async () => {
      if (revocationStarted || !active) return;
      revocationStarted = true;
      stopLifecycleChecks?.();
      setRevoked(true);
      // PersistQueryClientProvider may already be completing a restore that
      // serialized before revocation. Let its hydrate callback finish before
      // clearing memory so that late hydration cannot revive private queries.
      await restoreCompletion.promise;
      await clearPrivateDayLogMemory(queryClient);
      clearAuthenticatedSession(queryClient);
      if (active) await navigate({ to: "/signup-login" });
    };

    const checkFence = async () => {
      if (!(await lease.isCurrent())) await purgeRevokedSession();
    };

    const startLifecycleChecks = () => {
      const onPageShow = () => void checkFence();
      const onFocus = () => void checkFence();
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") void checkFence();
      };
      window.addEventListener("pageshow", onPageShow);
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);

      const interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void checkFence();
      }, LIFECYCLE_CHECK_INTERVAL_MS);

      let channel: BroadcastChannel | undefined;
      if (typeof BroadcastChannel !== "undefined") {
        try {
          channel = new BroadcastChannel(DAY_LOG_CACHE_BROADCAST_CHANNEL);
          channel.addEventListener("message", (event) => {
            if (
              isRevocation(event.data) &&
              event.data.accountId === accountId &&
              event.data.generation > lease.generation
            ) {
              void purgeRevokedSession();
            }
          });
        } catch {
          channel = undefined;
        }
      }

      stopLifecycleChecks = () => {
        window.clearInterval(interval);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        channel?.close();
      };
    };

    startLifecycleChecks();
    void checkFence();

    return () => {
      active = false;
      stopLifecycleChecks?.();
    };
  }, [accountId, lease, navigate, queryClient, restoreCompletion]);

  if (revoked) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      onError={restoreCompletion.complete}
      onSuccess={restoreCompletion.complete}
      persistOptions={{
        buster: DAY_LOG_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: (query) =>
            isPersistableDayLogQueryData(query.queryKey, query.state.data, accountId),
        },
        maxAge: DAY_LOG_CACHE_RETENTION_MS,
        persister: lease,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export function PrivateDayLogCacheProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const [lease, setLease] = useState<DayLogCacheLease>();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    setLease(undefined);
    void acquireDayLogCacheLease(accountId).then((acquiredLease) => {
      if (!active) return;
      // Native timers cannot represent the 30-day retention window reliably;
      // explicit pruning owns retention for this narrowly scoped query family.
      queryClient.setQueryDefaults(dayLogSlotQueryKeyPrefix(accountId), { gcTime: Infinity });
      setLease(acquiredLease);
    });
    return () => {
      active = false;
    };
  }, [accountId, queryClient]);

  // Do not mount private descendants before a fenced lease exists. Mounting them
  // here and again inside the lease boundary would discard route-local state and
  // briefly expose private query consumers before restoration can be fenced.
  if (!lease) return null;

  return (
    <LeasePersistenceBoundary key={`${accountId}:${lease.generation}`} accountId={accountId} lease={lease}>
      {children}
    </LeasePersistenceBoundary>
  );
}
