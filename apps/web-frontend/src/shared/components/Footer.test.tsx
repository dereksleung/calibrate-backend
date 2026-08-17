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

import Footer from "./Footer.tsx";

const mockUseIsMobile = vi.fn<() => boolean>();

vi.mock("#/shared/hooks/use-media-query.ts", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("#/pages/logs/log-page-helpers.ts", () => ({
  getTodayDateString: () => "2026-07-10",
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

async function renderFooter(initialEntry = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  await router.load();

  return render(
    <RouterContextProvider router={router}>
      <Footer />
    </RouterContextProvider>,
  );
}

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Footer", () => {
  describe("desktop", () => {
    // TO-DO: Add tests for desktop footer content, once that content is decided.
    it("does not render the mobile bottom tab navigation", async () => {
      await renderFooter();

      expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
    });
  });

  describe("mobile", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders the bottom tab navigation bar", async () => {
      await renderFooter();

      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      expect(nav.className).toContain("fixed");
      expect(nav.className).toContain("bottom-0");
      expect(nav.className).toContain("rounded-t-2xl");
    });

    it("renders tab links for overview, logs, and goals", async () => {
      await renderFooter();

      expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/");
      expect(screen.getByRole("link", { name: "Logs" }).getAttribute("href")).toBe("/logs?date=2026-07-10");
      expect(screen.getByRole("link", { name: "Goals" }).getAttribute("href")).toBe("/goals");
    });

    it("highlights the active tab for the current route", async () => {
      await renderFooter("/logs?date=2026-07-10");

      expect(screen.getByRole("link", { name: "Logs" }).className).toContain("text-primary");
      expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("text-primary");
    });

    it("does not render the desktop footer content", async () => {
      await renderFooter();

      expect(screen.queryByRole("contentinfo")).toBeNull();
      expect(screen.queryByText("Built with TanStack Start")).toBeNull();
      expect(screen.queryByRole("link", { name: "Follow TanStack on X" })).toBeNull();
    });
  });
});
