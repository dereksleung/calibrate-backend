// @vitest-environment jsdom

import { restoreDayLogCache } from "#/shared/api/day-log-cache.ts";
import { createQueryClient } from "#/shared/api/query-client.ts";
import {
  authenticatedSessionQueryKey,
  clearAuthenticatedSession,
  setAuthenticatedSession,
} from "#/verticals/auth/authenticated-session.ts";
import { dayLogQueryKey } from "@calibrate/api-client";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Header from "./Header.tsx";

const mockUseIsMobile = vi.fn<() => boolean>();
const { mockDeleteCurrentSession } = vi.hoisted(() => ({ mockDeleteCurrentSession: vi.fn() }));

vi.mock("@calibrate/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@calibrate/api-client")>()),
  deleteCurrentSession: mockDeleteCurrentSession,
}));

vi.mock("#/shared/hooks/use-media-query.ts", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("#/pages/logs/log-page-helpers.ts", () => ({
  getTodayDateString: () => "2026-07-10",
}));

vi.mock("./ThemeToggle.tsx", () => ({
  default: () => <div data-testid="theme-toggle" />,
}));

const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logs",
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" ? search.date : "2026-07-10",
  }),
  component: () => null,
});

const goalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/goals",
  component: () => null,
});

const signupLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup-login",
  component: () => null,
});

const routeTree = rootRoute.addChildren([indexRoute, logsRoute, goalsRoute, signupLoginRoute]);

const authenticatedSession = {
  user: {
    id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
    email: "person@example.com",
    tier: "FREE" as const,
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: new Date("2030-01-01T00:00:00.000Z"),
  },
  sessionTransport: "cookie" as const,
};

function createStorage() {
  const entries = new Map<string, string>();
  const storage = {
    getItem: vi.fn(async (key: string) => entries.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      entries.delete(key);
    }),
  };

  return { entries, storage };
}

class FakeBroadcastChannel {
  private static readonly channels = new Set<FakeBroadcastChannel>();
  private readonly listeners = new Set<(event: { data: unknown }) => void>();
  private closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.add(this);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    if (type === "message") this.listeners.add(listener);
  }

  postMessage(data: unknown): void {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;

      queueMicrotask(() => {
        if (channel.closed) return;
        for (const listener of channel.listeners) listener({ data });
      });
    }
  }

  close(): void {
    this.closed = true;
    FakeBroadcastChannel.channels.delete(this);
  }

  static reset(): void {
    for (const channel of FakeBroadcastChannel.channels) channel.close();
  }
}

async function renderHeader(
  initialEntry = "/",
  options?: { authenticated?: boolean; queryClient?: QueryClient },
) {
  const queryClient = options?.queryClient ?? createQueryClient();
  if (options?.authenticated) {
    setAuthenticatedSession(queryClient, authenticatedSession);
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <Header />
      </RouterContextProvider>
    </QueryClientProvider>,
  );

  return { queryClient, router, ...view };
}

beforeEach(() => {
  mockDeleteCurrentSession.mockResolvedValue(null);
  mockUseIsMobile.mockReturnValue(false);
  window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  FakeBroadcastChannel.reset();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Header", () => {
  describe("desktop", () => {
    it("renders the brand link", async () => {
      await renderHeader();

      expect(screen.getByRole("link", { name: "Calibrate" }).getAttribute("href")).toBe("/");
    });

    it("renders primary navigation links", async () => {
      await renderHeader();

      expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/");
      expect(screen.getByRole("link", { name: "Logs" }).getAttribute("href")).toBe("/logs?date=2026-07-10");
      expect(screen.getByRole("link", { name: "Goals" }).getAttribute("href")).toBe("/goals");
    });

    it("highlights the active navigation link for the current route", async () => {
      await renderHeader("/goals");

      expect(screen.getByRole("link", { name: "Goals" }).className).toContain("text-primary");
      expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("text-primary");
    });

    it("renders the login button alongside primary navigation for logged-out users", async () => {
      await renderHeader();

      expect(screen.getByRole("button", { name: "Sign Up" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Logs" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Goals" })).toBeTruthy();
    });

    it("shows the account avatar instead of Sign Up when logged in", async () => {
      await renderHeader("/", { authenticated: true });

      expect(screen.queryByRole("button", { name: "Sign Up" })).toBeNull();
      expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
    });

    it("waits for successful server logout before clearing the session and navigating", async () => {
      const { queryClient, router } = await renderHeader("/", { authenticated: true });
      queryClient.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(mockDeleteCurrentSession).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(queryClient.getQueryData(dayLogQueryKey("2026-07-10"))).toBeUndefined();
        expect(router.state.location.pathname).toBe("/signup-login");
      });
    });

    it("preserves authenticated state and shows a retryable error when logout fails", async () => {
      mockDeleteCurrentSession.mockRejectedValueOnce(new Error("offline"));
      const { queryClient, router } = await renderHeader("/", { authenticated: true });
      queryClient.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Unable to log out"));
      expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeDefined();
      expect(queryClient.getQueryData(dayLogQueryKey("2026-07-10"))).toEqual({ id: "private-day-log" });
      expect(router.state.location.pathname).toBe("/");
    });

    it("retries the server logout request after a failed logout", async () => {
      mockDeleteCurrentSession.mockRejectedValueOnce(new Error("offline"));
      const { queryClient, router } = await renderHeader("/", { authenticated: true });
      queryClient.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));
      await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(mockDeleteCurrentSession).toHaveBeenCalledTimes(2);
        expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(router.state.location.pathname).toBe("/signup-login");
      });
    });

    it("retries local cache cleanup after server logout succeeds", async () => {
      const { storage } = createStorage();
      storage.removeItem.mockRejectedValueOnce(new Error("IndexedDB write denied"));
      const queryClient = createQueryClient();
      await restoreDayLogCache(queryClient, authenticatedSession.user.id, {
        storageFactory: () => storage,
        throttleTime: 0,
      });
      queryClient.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });

      const { router } = await renderHeader("/", { authenticated: true, queryClient });

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Unable to log out"));
      expect(mockDeleteCurrentSession).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeDefined();
      expect(queryClient.getQueryData(dayLogQueryKey("2026-07-10"))).toEqual({ id: "private-day-log" });
      expect(router.state.location.pathname).toBe("/");

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(mockDeleteCurrentSession).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(queryClient.getQueryData(dayLogQueryKey("2026-07-10"))).toBeUndefined();
        expect(router.state.location.pathname).toBe("/signup-login");
      });
    });

    it("logs out other tabs without repeating the logout request", async () => {
      vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
      const { storage } = createStorage();
      const firstTab = createQueryClient();
      const secondTab = createQueryClient();
      const userId = authenticatedSession.user.id;
      const restoreOptions = { storageFactory: () => storage, throttleTime: 0 };

      await restoreDayLogCache(firstTab, userId, restoreOptions);
      const secondTabHeader = await renderHeader("/", { authenticated: true, queryClient: secondTab });
      await restoreDayLogCache(secondTab, userId, {
        ...restoreOptions,
        onRemoteClear: async () => {
          clearAuthenticatedSession(secondTab);
          await secondTabHeader.router.navigate({ to: "/signup-login" });
        },
      });
      firstTab.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });
      secondTab.setQueryData(dayLogQueryKey("2026-07-10"), { id: "private-day-log" });

      const firstTabHeader = await renderHeader("/", { authenticated: true, queryClient: firstTab });

      fireEvent.click(within(firstTabHeader.container).getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(mockDeleteCurrentSession).toHaveBeenCalledTimes(1);
        expect(firstTab.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(secondTab.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(firstTab.getQueryData(dayLogQueryKey("2026-07-10"))).toBeUndefined();
        expect(secondTab.getQueryData(dayLogQueryKey("2026-07-10"))).toBeUndefined();
        expect(firstTabHeader.router.state.location.pathname).toBe("/signup-login");
        expect(secondTabHeader.router.state.location.pathname).toBe("/signup-login");
      });
      expect(within(secondTabHeader.container).queryByRole("button", { name: "Account menu" })).toBeNull();
    });
  });

  describe("mobile", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders the brand link", async () => {
      await renderHeader();

      expect(screen.getByRole("link", { name: "Calibrate" }).getAttribute("href")).toBe("/");
    });

    it("renders the login button for logged-out users", async () => {
      await renderHeader();

      expect(screen.getByRole("button", { name: "Sign Up" })).toBeTruthy();
    });

    it("shows the account avatar instead of Sign Up when logged in", async () => {
      await renderHeader("/", { authenticated: true });

      expect(screen.queryByRole("button", { name: "Sign Up" })).toBeNull();
      expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
    });

    it("does not render desktop primary navigation links", async () => {
      await renderHeader();

      expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Logs" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Goals" })).toBeNull();
    });
  });
});
