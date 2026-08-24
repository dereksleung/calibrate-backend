// @vitest-environment jsdom

import { TooltipProvider } from "#/shared/components/base/tooltip/Tooltip.tsx";
import { dayLogQueryKey, dayLogRangeQueryKeyPrefix } from "@calibrate/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardNutritionDateRange } from "../../verticals/dashboard/dashboard-nutrition-model.ts";
import { Dashboard } from "./Dashboard.tsx";

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));

vi.mock("#/shared/components/charts/EatenDonutChart.tsx", () => ({
  EatenDonutChart: ({ eaten, metricLabel }: { eaten: number; metricLabel: string }) => (
    <div data-testid={`donut-chart-${metricLabel}`}>{eaten}</div>
  ),
}));

vi.mock("#/shared/components/charts/WeeklyBarChart.tsx", () => ({
  WeeklyBarChart: ({ seriesLabel }: { seriesLabel: string }) => (
    <div data-testid={`weekly-chart-${seriesLabel}`} />
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
});
const goalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/goals",
  component: () => null,
});
const routeTree = rootRoute.addChildren([indexRoute, goalsRoute]);

function createDashboardQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}

async function renderDashboard(queryClient = createDashboardQueryClient()) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>
        <TooltipProvider>
          <Dashboard />
        </TooltipProvider>
      </RouterContextProvider>
    </QueryClientProvider>,
  );

  return queryClient;
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

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const date = new Date(`${startDate}T00:00:00.000Z`);

  while (date.toISOString().slice(0, 10) <= endDate) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return dates;
}

function dayLogRangeResponse(url: string, calories: number) {
  const requestUrl = new URL(url);
  const startDate = requestUrl.searchParams.get("startDate");
  const endDate = requestUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    throw new Error("Expected day-log range request dates");
  }

  const dates = dateRange(startDate, endDate);
  const todayDate = dates.at(-1);

  return {
    startDate,
    endDate,
    days: dates.map((date) => ({
      date,
      dayLog:
        date === todayDate
          ? {
              id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
              date,
              breakfast: [
                {
                  id: "breakfast-entry",
                  meal: "BREAKFAST",
                  name: "Live breakfast",
                  brand: null,
                  calories,
                  totalFatGrams: 11,
                  saturatedFatGrams: null,
                  cholesterolMg: null,
                  sodiumMg: null,
                  totalCarbohydrateGrams: 37,
                  fiberGrams: null,
                  sugarGrams: null,
                  proteinGrams: 24,
                  chosenQuantity: 1,
                  chosenUnit: "serving",
                  quantityServing: 1,
                  servingLabel: "serving",
                  quantityMass: null,
                  massUnit: null,
                  quantityVolume: null,
                  volumeUnit: null,
                },
              ],
              lunch: [],
              dinner: [],
              snacks: [],
              weight: null,
            }
          : null,
    })),
  };
}

function seedDateKeyedRange(queryClient: QueryClient, response: ReturnType<typeof dayLogRangeResponse>) {
  for (const day of response.days) {
    queryClient.setQueryData(dayLogQueryKey(day.date), day.dayLog);
  }
}

beforeEach(() => {
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
  mockToastError.mockReset();
});

describe("dashboard live nutrition", () => {
  it("renders restored date-keyed entries immediately and corrects them in the background", async () => {
    const range = getDashboardNutritionDateRange();
    const rangeUrl = `http://localhost/api/v1/daylogs?startDate=${range.startDate}&endDate=${range.endDate}`;
    const queryClient = createDashboardQueryClient();
    seedDateKeyedRange(queryClient, dayLogRangeResponse(rangeUrl, 100));

    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    await renderDashboard(queryClient);

    expect(await screen.findByText(/100 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(fetchMock.mock.calls[0][0]), 250)), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    expect(await screen.findByText(/250 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
  });

  it("starts another background refresh when the browser regains focus", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const calories = fetchMock.mock.calls.length === 1 ? 100 : 250;

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), calories)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await renderDashboard();

    expect(await screen.findByText(/100 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();

    window.dispatchEvent(new Event("focus"));

    expect(await screen.findByText(/250 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests the inclusive seven-day range and renders API totals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(url, 425)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await renderDashboard();

    expect(await screen.findByText(/425 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
    expect(screen.getByTestId("donut-chart-Calories").textContent).toBe("425");
    expect(screen.getByRole("link", { name: "Open fats analytics details" }).getAttribute("href")).toBe(
      "/goals?openFatsAnalytics=true",
    );

    const requestUrl = new URL(getFetchUrl(fetchMock.mock.calls[0][0]));
    const startDate = requestUrl.searchParams.get("startDate");
    const endDate = requestUrl.searchParams.get("endDate");

    expect(requestUrl.pathname).toBe("/api/v1/daylogs");
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
    expect(dateRange(startDate!, endDate!)).toHaveLength(7);
  });

  it("keeps the stats area usable while loading", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => undefined));

    await renderDashboard();

    expect(screen.getByRole("status", { name: "Loading live nutrition statistics" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Daily & Weekly Stats" })).toBeTruthy();
  });

  it("shows an inline error, then refetches after retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("server error", { status: 500, statusText: "Internal Server Error" }),
      );
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), 425)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await renderDashboard();

    expect((await screen.findByRole("alert")).textContent).toContain("Live nutrition is unavailable");
    expect(mockToastError).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(/425 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
  });

  it("updates the active dashboard range after a day-log range invalidation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const calories = fetchMock.mock.calls.length === 1 ? 100 : 250;

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), calories)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const queryClient = await renderDashboard();

    expect(await screen.findByText(/100 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();

    await queryClient.invalidateQueries({ queryKey: dayLogRangeQueryKeyPrefix });

    await waitFor(() => {
      expect(screen.getByText(/250 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();
    });
  });
});
