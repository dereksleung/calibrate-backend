// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "#/shared/api/query-client.ts";
import { routeTree } from "../../routeTree.gen.ts";
import { coffeeFixture, oatmealFixture } from "./log-page-fixtures.ts";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

const dayLogMay18Response = {
  id: "94e23c4b-cd80-4b8e-b10c-4b263e710ec2",
  date: "2026-05-18",
  breakfast: [oatmealFixture, coffeeFixture],
  lunch: [],
  dinner: [],
  snacks: [],
  weight: 184.2,
};

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
    if (url.includes("/auth/session")) {
      return Promise.resolve(
        new Response(JSON.stringify({
          user: { id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff", email: "person@example.com", tier: "FREE", createdAt: "2030-01-01T00:00:00.000Z", updatedAt: "2030-01-01T00:00:00.000Z" },
          sessionTransport: "cookie",
        }), { status: 200, headers: { "content-type": "application/json" } }),
      );
    }
    if (url.includes("/daylogs/2026-05-18")) {
      return Promise.resolve(
        new Response(JSON.stringify(dayLogMay18Response), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }

    return Promise.resolve(new Response("not found", { status: 404 }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderLogsRoute() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/logs?date=2026-05-18"],
    }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("Logs", () => {
  it("renders the daily overview shell from fixture data", async () => {
    renderLogsRoute();

    expect(await screen.findByRole("heading", { name: "Monday, May 18" })).toBeTruthy();
    expect(await screen.findByText("282")).toBeTruthy();
    expect(screen.getByText("/ 1,800")).toBeTruthy();
    expect(screen.getByText("1,518 left")).toBeTruthy();
    expect(screen.getByText("184.2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Breakfast" })).toBeTruthy();
    expect(screen.getByText("Oatmeal")).toBeTruthy();
    expect(screen.getByText("Black coffee")).toBeTruthy();
  });

  it("renders empty meal states and meal add actions", async () => {
    renderLogsRoute();

    expect(await screen.findByRole("heading", { name: "Lunch" })).toBeTruthy();
    expect(screen.getAllByText("No items logged yet").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "No items logged yet" })[0]);

    expect(await screen.findByRole("heading", { name: "Recently logged" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
  });

  it("opens the quick log drawer from the floating action button", async () => {
    renderLogsRoute();

    fireEvent.click(await screen.findByRole("button", { name: "Open quick log actions" }));

    expect(await screen.findByText("Quick log")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search food" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log weight" })).toBeTruthy();
  });
});
