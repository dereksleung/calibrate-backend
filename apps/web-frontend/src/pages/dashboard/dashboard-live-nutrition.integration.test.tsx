// @vitest-environment jsdom

import { getRollingSevenDayDateRange } from "#/shared/date/local-date-range.ts";
import { dayLogRangeQueryKey, dayLogRangeQueryKeyPrefix } from "@calibrate/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardV2Container } from "./DashboardV2/DashboardV2Container.tsx";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
}));

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

function renderDashboard(queryClient = createDashboardQueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardV2Container />
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

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

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
});

describe("dashboard live nutrition", () => {
  it("requests the inclusive seven-day range and renders selected Dashboard V2 values", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(url, 425)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const queryClient = renderDashboard();

    expect(await screen.findByRole("button", { name: "Open Calories analytics" })).toBeTruthy();
    const calories = screen.getByRole("region", { name: "Calories" });
    expect(within(calories).getByText("425")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Seven-day nutrition summary" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Weighing" })).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Daily Insights" })).toBeNull();

    const requestUrl = new URL(getFetchUrl(fetchMock.mock.calls[0][0]));
    const startDate = requestUrl.searchParams.get("startDate");
    const endDate = requestUrl.searchParams.get("endDate");

    expect(requestUrl.pathname).toBe("/api/v1/daylogs");
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
    expect(dateRange(startDate!, endDate!)).toHaveLength(7);

    const cached = queryClient.getQueryData(dayLogRangeQueryKey(getRollingSevenDayDateRange()));
    expect(cached).toEqual(
      expect.objectContaining({
        days: expect.any(Array),
        endDate,
        startDate,
      }),
    );
    expect(cached).not.toHaveProperty("nutritionCards");
    expect(cached).not.toHaveProperty("analytics");
  });

  it("keeps the page structure usable while loading", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => undefined));

    renderDashboard();

    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Seven-day nutrition" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Habits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nutrition" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Weighing" })).getByRole("img").children).toHaveLength(
      30,
    );
    expect(screen.queryByRole("button", { name: "Open Calories analytics" })).toBeNull();
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

    renderDashboard();

    expect((await screen.findByRole("alert")).textContent).toContain("Live nutrition is unavailable");
    expect(screen.queryByText("425")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: "Open Calories analytics" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Calories" })).getByText("425")).toBeTruthy();
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

    const queryClient = renderDashboard();

    expect(await screen.findByRole("button", { name: "Open Calories analytics" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Calories" })).getByText("100")).toBeTruthy();

    await queryClient.invalidateQueries({ queryKey: dayLogRangeQueryKeyPrefix });

    await waitFor(() => {
      expect(within(screen.getByRole("region", { name: "Calories" })).getByText("250")).toBeTruthy();
    });
  });

  it("opens the selected Nutrition card drawer", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), 425)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Open Calories analytics" }));

    expect(screen.getByRole("dialog", { name: "Calories analytics" })).toBeTruthy();
    expect(screen.getByText("Live breakfast")).toBeTruthy();
  });
});
