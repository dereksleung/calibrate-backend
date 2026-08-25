// @vitest-environment jsdom

import type { ApiTransport } from "@calibrate/api-client";
import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import { clearDayLogCache, restoreDayLogCache } from "#/shared/api/day-log-cache.ts";
import {
  getAuthenticatedSession,
  setAuthenticatedSession,
} from "#/verticals/auth/authenticated-session.ts";
import { dayLogQueryKey, dayLogRangeQueryKey } from "@calibrate/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import {
  composeDayLogRangeFromCache,
  useDashboardDayLogRange,
  writeDayLogRangeToCache,
} from "./dashboard-day-log-query.ts";

const { mockGetDayLogRange } = vi.hoisted(() => ({ mockGetDayLogRange: vi.fn() }));

vi.mock("@calibrate/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@calibrate/api-client")>()),
  getDayLogRange: mockGetDayLogRange,
}));

const range = {
  startDate: "2026-08-20",
  endDate: "2026-08-22",
};

const emptyDayLog = {
  id: "00000000-0000-0000-0000-000000000001",
  date: "2026-08-21",
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
  weight: 180,
} as const;

function response(): DayLogRangeResponse {
  return {
    ...range,
    days: [
      { date: "2026-08-20", dayLog: null },
      { date: "2026-08-21", dayLog: emptyDayLog },
      { date: "2026-08-22", dayLog: null },
    ],
  } as DayLogRangeResponse;
}

describe("dashboard Day Log query composition", () => {
  it("normalizes a range response into date-keyed entries and composes it back", () => {
    const queryClient = new QueryClient();

    writeDayLogRangeToCache(queryClient, response());

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-20"))).toBeNull();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-21"))).toEqual(emptyDayLog);
    expect(composeDayLogRangeFromCache(queryClient, range)).toEqual(response());
  });

  it("does not treat an unloaded date as a Known-empty day", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(dayLogQueryKey("2026-08-20"), null);
    queryClient.setQueryData(dayLogQueryKey("2026-08-21"), emptyDayLog);

    expect(composeDayLogRangeFromCache(queryClient, range)).toBeUndefined();
  });

  it("stops publishing a range when its cache becomes invalid during publication", () => {
    const queryClient = new QueryClient();
    const canWrite = () => queryClient.getQueryData(dayLogQueryKey("2026-08-20")) === undefined;

    expect(writeDayLogRangeToCache(queryClient, response(), canWrite)).toBe(false);
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-20"))).toBeNull();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-21"))).toBeUndefined();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
  });
});

describe("dashboard Day Log query isolation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not publish an earlier account's range response after cache replacement", async () => {
    let resolveRange!: (value: DayLogRangeResponse) => void;
    mockGetDayLogRange.mockReturnValueOnce(
      new Promise<DayLogRangeResponse>((resolve) => {
        resolveRange = resolve;
      }),
    );
    const storage = {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const sessionA = {
      user: {
        id: "user-a",
        email: "user-a@example.com",
        tier: "FREE" as const,
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      sessionTransport: "cookie" as const,
    };
    const sessionB = {
      ...sessionA,
      user: { ...sessionA.user, id: "user-b", email: "user-b@example.com" },
    };

    setAuthenticatedSession(queryClient, sessionA);
    await restoreDayLogCache(queryClient, sessionA.user.id, {
      storageFactory: () => storage,
    });

    function DashboardRangeReader() {
      useDashboardDayLogRange({} as ApiTransport, range);
      return null;
    }

    const { unmount } = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(DashboardRangeReader),
      ),
    );
    await waitFor(() => expect(mockGetDayLogRange).toHaveBeenCalledTimes(1));

    unmount();
    await clearDayLogCache(queryClient, sessionA.user.id, { storageFactory: () => storage });
    setAuthenticatedSession(queryClient, sessionB);
    await restoreDayLogCache(queryClient, sessionB.user.id, {
      storageFactory: () => storage,
    });
    resolveRange(response());
    await Promise.resolve();
    await Promise.resolve();

    expect(getAuthenticatedSession(queryClient)?.user.id).toBe(sessionB.user.id);
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-21"))).toBeUndefined();
  });

  it("keeps range query garbage collection finite", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = {
      user: {
        id: "user-a",
        email: "user-a@example.com",
        tier: "FREE" as const,
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      sessionTransport: "cookie" as const,
    };
    setAuthenticatedSession(queryClient, session);
    await restoreDayLogCache(queryClient, session.user.id, { storageFactory: () => null });
    mockGetDayLogRange.mockResolvedValueOnce(response());

    function DashboardRangeReader() {
      useDashboardDayLogRange({} as ApiTransport, range);
      return null;
    }

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(DashboardRangeReader),
      ),
    );

    await waitFor(() => {
      const rangeQuery = queryClient.getQueryCache().find({ queryKey: dayLogRangeQueryKey(range) });
      expect(rangeQuery?.options.gcTime).toBeLessThan(Infinity);
    });
  });
});
