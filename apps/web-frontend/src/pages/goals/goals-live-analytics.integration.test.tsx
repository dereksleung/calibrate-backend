// @vitest-environment jsdom

import { dayLogRangeQueryKeyPrefix } from "@calibrate/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "../../routeTree.gen.ts";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { error: mockToastError },
}));

vi.mock("#/verticals/goals-analytics/components/FatBarChart.tsx", () => ({
  FatBarChart: ({
    data,
  }: {
    data: Array<{ date: string; eaten: number | null; label: string; limit: number }>;
  }) => (
    <div data-testid="live-fat-chart">
      {data.map((day) => (
        <span key={day.date} data-testid={`fat-slot-${day.date}`}>
          {day.label}:{day.eaten ?? "missing"}:{day.limit}
        </span>
      ))}
    </div>
  ),
}));

function createGoalsQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}

function renderGoalsRoute(initialEntry = "/goals", queryClient = createGoalsQueryClient()) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
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

function authenticatedSessionResponse(): Response {
  return new Response(
    JSON.stringify({
      user: {
        id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        email: "person@example.com",
        tier: "FREE",
        createdAt: "2030-01-01T00:00:00.000Z",
        updatedAt: "2030-01-01T00:00:00.000Z",
      },
      sessionTransport: "cookie",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function dayLogRangeResponse(url: string, firstFat: number, lastFat: number) {
  const requestUrl = new URL(url);
  const startDate = requestUrl.searchParams.get("startDate");
  const endDate = requestUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    throw new Error("Expected day-log range request dates");
  }

  const dates = dateRange(startDate, endDate);

  return {
    startDate,
    endDate,
    days: dates.map((date, index) => ({
      date,
      dayLog:
        index === 0 || index === dates.length - 1
          ? {
            id:
              index === 0 ? "e74942b3-78d7-48e8-bd20-dc5eba7f82ff" : "f84942b3-78d7-48e8-bd20-dc5eba7f82ff",
            date,
            breakfast: [
              {
                id: `breakfast-${index}`,
                meal: "BREAKFAST" as const,
                name: "Live breakfast",
                brand: null,
                calories: 100,
                totalFatGrams: index === 0 ? firstFat : lastFat,
                saturatedFatGrams: null,
                cholesterolMg: null,
                sodiumMg: null,
                totalCarbohydrateGrams: 10,
                fiberGrams: null,
                sugarGrams: null,
                proteinGrams: 10,
                chosenQuantity: 1,
                chosenUnit: "serving" as const,
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
            weight: index === 0 ? 180 : 178,
          }
          : null,
    })),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 7, 12, 12));
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
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  mockToastError.mockReset();
});

describe("Goals live seven-day analytics", () => {
  it("shows chart placeholders while the seven-day data is loading", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      if (getFetchUrl(input).includes("/auth/session")) {
        return Promise.resolve(authenticatedSessionResponse());
      }

      return new Promise<Response>(() => undefined);
    });

    renderGoalsRoute();

    const loadingState = await screen.findByRole("status", { name: "Loading live Goals charts" });

    expect(loadingState.querySelectorAll('[data-slot="card"]')).toHaveLength(2);
    expect(screen.queryByTestId("live-fat-chart")).toBeNull();
  });

  it("scrolls to the fats chart after the live data mounts", async () => {
    let rangeUrl: string | undefined;
    let resolveRange: (response: Response) => void = () => undefined;
    const rangeResponse = new Promise<Response>((resolve) => {
      resolveRange = resolve;
    });
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = getFetchUrl(input);

      if (url.includes("/auth/session")) {
        return Promise.resolve(authenticatedSessionResponse());
      }

      rangeUrl = url;
      return rangeResponse;
    });

    try {
      renderGoalsRoute("/goals?openFatsAnalytics=true");

      expect(
        await screen.findByRole("status", { hidden: true, name: "Loading live Goals charts" }),
      ).toBeTruthy();
      await waitFor(() => expect(rangeUrl).toBeDefined());
      expect(scrollIntoView).not.toHaveBeenCalled();

      resolveRange(
        new Response(JSON.stringify(dayLogRangeResponse(rangeUrl!, 10, 25)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      expect(await screen.findByTestId("live-fat-chart")).toBeTruthy();
      await waitFor(() =>
        expect(scrollIntoView).toHaveBeenCalledWith({
          behavior: "smooth",
          block: "center",
        }),
      );
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("requests the rolling range and renders live fat slots with dynamic labels", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) =>
      getFetchUrl(input).includes("/auth/session")
        ? Promise.resolve(authenticatedSessionResponse())
        : Promise.resolve(
          new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), 10, 25)), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
    );

    renderGoalsRoute();

    expect(await screen.findByTestId("live-fat-chart")).toBeTruthy();
    expect(screen.getByTestId("fat-slot-2026-08-06").textContent).toContain("Th:10:60");
    expect(screen.getByTestId("fat-slot-2026-08-07").textContent).toContain("F:missing:60");
    expect(screen.getByTestId("fat-slot-2026-08-12").textContent).toContain("W:25:60");
    expect(screen.getByText("-2.0 lbs")).toBeTruthy();

    const rangeRequest = fetchMock.mock.calls.find(([input]) => getFetchUrl(input).includes("/daylogs"));
    expect(rangeRequest).toBeTruthy();
    const requestUrl = new URL(getFetchUrl(rangeRequest![0]));
    expect(requestUrl.pathname).toBe("/api/v1/daylogs");
    expect(
      dateRange(requestUrl.searchParams.get("startDate")!, requestUrl.searchParams.get("endDate")!),
    ).toHaveLength(7);
  });

  it("shows a retryable initial error toast and renders data after refetch", async () => {
    let rangeCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      if (getFetchUrl(input).includes("/auth/session")) {
        return Promise.resolve(authenticatedSessionResponse());
      }

      rangeCalls += 1;
      if (rangeCalls === 1) {
        return Promise.reject(new Error("server error"));
      }

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), 10, 25)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    renderGoalsRoute();

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("live-fat-chart")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    const [, toastOptions] = mockToastError.mock.calls[0];
    expect(toastOptions).toEqual(
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Try again",
          onClick: expect.any(Function),
        }),
        classNames: expect.objectContaining({
          actionButton: expect.stringContaining("min-h-11"),
        }),
      }),
    );

    toastOptions.action.onClick();

    expect(await screen.findByTestId("live-fat-chart")).toBeTruthy();
  });

  it("keeps the successful chart visible after a background refresh failure", async () => {
    let rangeCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      if (getFetchUrl(input).includes("/auth/session")) {
        return Promise.resolve(authenticatedSessionResponse());
      }

      rangeCalls += 1;
      if (rangeCalls === 2) {
        return Promise.resolve(new Response("server error", { status: 500 }));
      }

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), 10, 25)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const queryClient = renderGoalsRoute();

    expect((await screen.findByTestId("fat-slot-2026-08-06")).textContent).toContain(":10:60");

    await queryClient.invalidateQueries({ queryKey: dayLogRangeQueryKeyPrefix });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("fat-slot-2026-08-06").textContent).toContain(":10:60");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    const [, toastOptions] = mockToastError.mock.calls[0];
    expect(toastOptions.action.label).toBe("Try again");
  });

  it("refreshes the mounted chart after range invalidation", async () => {
    let rangeCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
      if (getFetchUrl(input).includes("/auth/session")) {
        return Promise.resolve(authenticatedSessionResponse());
      }

      rangeCalls += 1;
      const fat = rangeCalls === 1 ? 10 : 25;

      return Promise.resolve(
        new Response(JSON.stringify(dayLogRangeResponse(getFetchUrl(input), fat, fat)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const queryClient = renderGoalsRoute();

    expect((await screen.findByTestId("fat-slot-2026-08-12")).textContent).toContain(":10:60");

    await queryClient.invalidateQueries({ queryKey: dayLogRangeQueryKeyPrefix });

    await waitFor(() => expect(screen.getByTestId("fat-slot-2026-08-12").textContent).toContain(":25:60"));
  });
});
