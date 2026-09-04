// @vitest-environment jsdom

import { authenticatedSessionQueryKey } from "#/verticals/auth/authenticated-session.ts";
import { QueryClient, QueryClientProvider, dehydrate, useQuery } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DayLogCacheLease } from "./indexed-db-day-log-cache.ts";

import { DAY_LOG_CACHE_BUSTER, dayLogSlotQueryKey, type DayLogSlot } from "./day-log-cache.ts";
import { PrivateDayLogCacheProvider } from "./private-day-log-cache-provider.tsx";

const { acquireDayLogCacheLease } = vi.hoisted(() => ({ acquireDayLogCacheLease: vi.fn() }));

vi.mock("./indexed-db-day-log-cache.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./indexed-db-day-log-cache.ts")>()),
  acquireDayLogCacheLease,
}));

const accountId = "e74942b3-78d7-48e8-bd20-dc5eba7f82ff";
const slot: DayLogSlot = {
  status: "known-empty",
  date: "2026-09-03",
  lastValidatedAt: Date.parse("2026-09-03T18:00:00.000Z"),
  unverified: false,
};

function createLease(overrides: Partial<DayLogCacheLease> = {}): DayLogCacheLease {
  return {
    accountId,
    generation: 4,
    storageAvailable: true,
    isCurrent: vi.fn().mockResolvedValue(true),
    persistClient: vi.fn().mockResolvedValue(undefined),
    removeClient: vi.fn().mockResolvedValue(undefined),
    restoreClient: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function CachedSlot() {
  const { data, isPending } = useQuery({
    queryKey: dayLogSlotQueryKey(accountId, slot.date),
    queryFn: async () => {
      throw new Error("restoration must finish before the query runs");
    },
    staleTime: Infinity,
  });
  return <p>{data ? (data as DayLogSlot).status : isPending ? "waiting" : "unavailable"}</p>;
}

function renderProvider(queryClient: QueryClient) {
  const rootRoute = createRootRoute({ component: () => null });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/signup-login",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, loginRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <PrivateDayLogCacheProvider accountId={accountId}>
          <CachedSlot />
        </PrivateDayLogCacheProvider>
      </RouterContextProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PrivateDayLogCacheProvider", () => {
  it("does not mount private descendants before a fenced lease exists", async () => {
    let resolveLease!: (lease: DayLogCacheLease) => void;
    acquireDayLogCacheLease.mockReturnValue(
      new Promise<DayLogCacheLease>((resolve) => {
        resolveLease = resolve;
      }),
    );

    renderProvider(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    expect(screen.queryByText("waiting")).toBeNull();
    resolveLease(createLease());
    expect(await screen.findByText("unavailable")).toBeTruthy();
  });

  it("restores the fenced cache before descendant queries may fetch", async () => {
    const storedClient = new QueryClient();
    storedClient.setQueryData(dayLogSlotQueryKey(accountId, slot.date), slot);
    acquireDayLogCacheLease.mockResolvedValue(
      createLease({
        restoreClient: vi.fn().mockResolvedValue({
          buster: DAY_LOG_CACHE_BUSTER,
          timestamp: Date.now(),
          clientState: dehydrate(storedClient),
        }),
      }),
    );

    renderProvider(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    expect(await screen.findByText("known-empty")).toBeTruthy();
  });

  it("falls back to online queries when IndexedDB is unavailable", async () => {
    acquireDayLogCacheLease.mockResolvedValue(
      createLease({ storageAvailable: false, restoreClient: vi.fn().mockResolvedValue(undefined) }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderProvider(queryClient);

    await waitFor(() => {
      expect(queryClient.getQueryState(dayLogSlotQueryKey(accountId, slot.date))?.status).toBe("error");
    });
  });

  it("purges private memory and navigates before reuse when a durable fence changes", async () => {
    const isCurrent = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    acquireDayLogCacheLease.mockResolvedValue(createLease({ isCurrent }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(authenticatedSessionQueryKey, { user: { id: accountId } });
    queryClient.setQueryData(dayLogSlotQueryKey(accountId, slot.date), slot);
    const router = renderProvider(queryClient);

    await waitFor(() => expect(isCurrent).toHaveBeenCalled());
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
      expect(queryClient.getQueryData(dayLogSlotQueryKey(accountId, slot.date))).toBeUndefined();
      expect(router.state.location.pathname).toBe("/signup-login");
    });
  });
});
