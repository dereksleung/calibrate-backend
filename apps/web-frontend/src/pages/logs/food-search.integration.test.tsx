// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "../../routeTree.gen.ts";
import { createQueryClient } from "#/shared/api/query-client.ts";

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

    if (url.includes("/auth/session")) {
      return Promise.resolve(new Response(JSON.stringify({
        user: {
          id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
          email: "person@example.com",
          tier: "FREE",
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z",
        },
        sessionTransport: "cookie",
      }), { status: 200, headers: { "content-type": "application/json" } }));
    }

    return Promise.resolve(new Response("not found", { status: 404 }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderFoodSearchRoute() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/logs/food-search?date=2026-05-18&meal=BREAKFAST"],
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

describe("food search route", () => {
  it("renders mock foods and records a selection for confirmation", async () => {
    renderFoodSearchRoute();

    fireEvent.click(await screen.findByRole("button", { name: /select Zero Sugar Oat/i }));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Zero Sugar Oat selected for confirmation.");
  });
});
