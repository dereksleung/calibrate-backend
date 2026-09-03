// @vitest-environment jsdom

import { createQueryClient } from "#/shared/api/query-client.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "../../routeTree.gen.ts";
import { coffeeFixture, oatmealFixture } from "./log-page-fixtures.ts";

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderLogsRoute(initialEntry: string, queryClient?: QueryClient) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  return render(
    <QueryClientProvider client={queryClient ?? createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function getFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

describe("logs live day log", () => {
  it("renders overview totals from the selected-day API response", async () => {
    const dayLog = {
      id: "day-log-live",
      date: "2026-06-10T00:00:00.000Z",
      breakfast: [oatmealFixture, coffeeFixture],
      lunch: [],
      dinner: [],
      snacks: [],
      weight: 184.2,
    };

    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);
      if (url.includes("/daylogs/2026-06-10")) {
        return Promise.resolve(
          new Response(JSON.stringify(dayLog), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }

      return Promise.resolve(new Response("not found", { status: 404 }));
    });

    renderLogsRoute("/logs?date=2026-06-10");

    expect(await screen.findByRole("heading", { name: "Wednesday, June 10" })).toBeTruthy();
    expect((await screen.findAllByText("282")).length).toBeGreaterThan(0);
    expect(screen.getByText("1,518 calories remaining today.")).toBeTruthy();
    expect(screen.getByText("Oatmeal")).toBeTruthy();
  });

  it("treats a null JSON body as an empty day while keeping the overview layout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);
      if (url.includes("/daylogs/2026-06-11")) {
        return Promise.resolve(
          new Response(JSON.stringify(null), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }

      return Promise.resolve(new Response("not found", { status: 404 }));
    });

    renderLogsRoute("/logs?date=2026-06-11");

    expect(await screen.findByRole("heading", { name: "Thursday, June 11" })).toBeTruthy();
    expect(await screen.findByText("1,800 calories remaining today.")).toBeTruthy();
    expect(screen.queryByText("Oatmeal")).toBeNull();
    expect(screen.getAllByRole("button", { name: "+ Add Item" }).length).toBe(4);
  });

  it("shows an error state with retry and refetches successfully", async () => {
    const dayLog = {
      id: "day-log-retry",
      date: "2026-06-12T00:00:00.000Z",
      breakfast: [coffeeFixture],
      lunch: [],
      dinner: [],
      snacks: [],
      weight: null,
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("server error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(dayLog), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    renderLogsRoute("/logs?date=2026-06-12", queryClient);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Could not load this day/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Black coffee")).toBeTruthy();
  });

  it("updates eaten calories when the selected date changes", async () => {
    const heavyEntry = { ...oatmealFixture, id: "heavy", name: "Heavy meal", calories: 550 };
    const lightEntry = { ...oatmealFixture, id: "light", name: "Light meal", calories: 120 };

    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);
      if (url.includes("/daylogs/2026-01-01")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "a",
              date: "2026-01-01T00:00:00.000Z",
              breakfast: [heavyEntry],
              lunch: [],
              dinner: [],
              snacks: [],
              weight: null,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }

      if (url.includes("/daylogs/2026-01-02")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "b",
              date: "2026-01-02T00:00:00.000Z",
              breakfast: [lightEntry],
              lunch: [],
              dinner: [],
              snacks: [],
              weight: null,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }

      return Promise.resolve(new Response("not found", { status: 404 }));
    });

    renderLogsRoute("/logs?date=2026-01-01");

    expect(await screen.findByText("Heavy meal")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("link", { name: "Next day" })[0]);

    expect(await screen.findByText("Light meal")).toBeTruthy();
    expect(screen.queryByText("Heavy meal")).toBeNull();
  });
});
