// @vitest-environment jsdom

import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const routeTree = rootRoute.addChildren([indexRoute, logsRoute, goalsRoute]);

async function renderHeader(initialEntry = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();

  return render(
    <RouterContextProvider router={router}>
      <Header />
    </RouterContextProvider>,
  );
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

      expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Logs" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Goals" })).toBeTruthy();
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

      expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
    });

    it("does not render desktop primary navigation links", async () => {
      await renderHeader();

      expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Logs" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Goals" })).toBeNull();
    });
  });
});
