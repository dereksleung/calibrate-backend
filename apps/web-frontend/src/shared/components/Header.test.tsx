// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "#/shared/api/query-client.ts";
import {
  authenticatedSessionQueryKey,
  setAuthenticatedSession,
} from "#/verticals/auth/authenticated-session.ts";

import Header from "./Header.tsx";

const mockUseIsMobile = vi.fn<() => boolean>();

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  logsRoute,
  goalsRoute,
  signupLoginRoute,
]);

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

async function renderHeader(
  initialEntry = "/",
  options?: { authenticated?: boolean },
) {
  const queryClient = createQueryClient();
  if (options?.authenticated) {
    setAuthenticatedSession(queryClient, authenticatedSession);
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <Header />
      </RouterContextProvider>
    </QueryClientProvider>,
  );

  return { queryClient, router };
}

beforeEach(() => {
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
      expect(screen.getByRole("link", { name: "Logs" }).getAttribute("href")).toBe(
        "/logs?date=2026-07-10",
      );
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

    it("opens a logout option from the account avatar and clears the session", async () => {
      const { queryClient, router } = await renderHeader("/", { authenticated: true });

      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
      fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toBeUndefined();
        expect(router.state.location.pathname).toBe("/signup-login");
      });
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
