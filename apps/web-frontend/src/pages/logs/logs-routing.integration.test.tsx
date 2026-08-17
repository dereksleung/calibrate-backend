// @vitest-environment jsdom

import { createQueryClient } from "#/shared/api/query-client.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "../../routeTree.gen.ts";
import { formatCompactDateHeading, formatDateHeading } from "./log-page-helpers.ts";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

beforeEach(() => {
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

  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
    if (url.includes("/daylogs/")) {
      return Promise.resolve(
        new Response(JSON.stringify(null), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }

    return Promise.resolve(new Response("not found", { status: 404 }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderLogsRoute(initialEntry: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("logs route", () => {
  it("uses a valid selected date from URL search", async () => {
    renderLogsRoute("/logs?date=2026-04-30");

    expect(await screen.findByRole("heading", { name: "Thursday, April 30" })).toBeTruthy();
  });

  it("normalizes invalid selected-date search to today", async () => {
    renderLogsRoute("/logs?date=not-a-date");
    const today = new Date();

    expect(await screen.findByText(formatCompactDateHeading(today))).toBeTruthy();
    expect(await screen.findByRole("heading", { name: formatDateHeading(today) })).toBeTruthy();
  });
});
