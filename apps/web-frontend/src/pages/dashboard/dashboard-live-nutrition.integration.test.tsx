// @vitest-environment jsdom

import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import { getRollingSevenDayDateRange } from "#/shared/date/local-date-range.ts";
import { setAuthenticatedSession } from "#/verticals/auth/authenticated-session.ts";
import {
  DAY_LOG_VALIDATION_FRESHNESS_MS,
  dayLogSlotQueryKey,
  dayLogSlotsFromRangeResponse,
} from "#/verticals/day-log-cache/day-log-cache.ts";
import { dayLogRangeQueryKey, dayLogRangeQueryKeyPrefix } from "@calibrate/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardV2Container } from "./DashboardV2/DashboardV2Container.tsx";

const accountId = "e74942b3-78d7-48e8-bd20-dc5eba7f82ff";
const authenticatedSession = {
  user: {
    id: accountId,
    email: "person@example.com",
    tier: "FREE" as const,
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: new Date("2030-01-01T00:00:00.000Z"),
  },
  sessionTransport: "cookie" as const,
};

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
  setAuthenticatedSession(queryClient, authenticatedSession);
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

function dayLogRangeResponse(url: string, calories: number): DayLogRangeResponse {
  const requestUrl = new URL(url, "http://localhost");
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

function seedDashboardCache(
  queryClient: QueryClient,
  calories: number,
  lastValidatedAt: number,
  cacheAccountId = accountId,
) {
  const range = getRollingSevenDayDateRange();
  const response = dayLogRangeResponse(
    `/api/v1/daylogs?startDate=${range.startDate}&endDate=${range.endDate}`,
    calories,
  );
  for (const slot of dayLogSlotsFromRangeResponse(response, lastValidatedAt)) {
    queryClient.setQueryData(dayLogSlotQueryKey(cacheAccountId, slot.date), slot);
  }
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

    await waitFor(() => {
      expect(queryClient.getQueryData(dayLogSlotQueryKey(accountId, endDate!))).toEqual(
        expect.objectContaining({ status: "present", lastValidatedAt: expect.any(Number) }),
      );
    });
    expect(queryClient.getQueryData(dayLogRangeQueryKey(accountId, getRollingSevenDayDateRange()))).toEqual(
      expect.objectContaining({ startDate, endDate }),
    );
  });

  it("renders a complete fresh cache without requesting the range", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not fetch"));
    const queryClient = createDashboardQueryClient();
    seedDashboardCache(queryClient, 315, Date.now());

    renderDashboard(queryClient);

    expect(within(screen.getByRole("region", { name: "Calories" })).getByText("315")).toBeTruthy();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders stale cached values while background validation is in flight", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>(() => undefined));
    const queryClient = createDashboardQueryClient();
    seedDashboardCache(queryClient, 210, Date.now() - DAY_LOG_VALIDATION_FRESHNESS_MS);

    renderDashboard(queryClient);

    expect(within(screen.getByRole("region", { name: "Calories" })).getByText("210")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("does not compose another account's cached slots", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => undefined));
    const queryClient = createDashboardQueryClient();
    seedDashboardCache(queryClient, 999, Date.now(), "95434f9a-da1f-47dd-8175-a26ff42ee11e");

    renderDashboard(queryClient);

    expect(screen.queryByText("999")).toBeNull();
    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeTruthy();
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

    await queryClient.invalidateQueries({ queryKey: dayLogRangeQueryKeyPrefix(accountId) });

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
