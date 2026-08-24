// @vitest-environment jsdom

import { dayLogQueryKey, dayLogRangeQueryKey } from "@calibrate/api-client";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DAY_LOG_CACHE_BUSTER,
  DAY_LOG_CACHE_MAX_AGE_MS,
  clearDayLogCache,
  dayLogCacheStorageKey,
  restoreDayLogCache,
} from "./day-log-cache.ts";

type StoredCache = Map<string, string>;

function createStorage(initialEntries: Record<string, string> = {}) {
  const entries: StoredCache = new Map(Object.entries(initialEntries));
  const storage = {
    getItem: vi.fn(async (key: string) => entries.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      entries.delete(key);
    }),
  };

  return { entries, storage };
}

function createDayLog(date: string, calories = 120) {
  return {
    id: `day-log-${date}`,
    date,
    breakfast: [
      {
        id: `entry-${date}`,
        meal: "BREAKFAST" as const,
        name: "Oatmeal",
        brand: null,
        calories,
        totalFatGrams: 4,
        saturatedFatGrams: null,
        cholesterolMg: null,
        sodiumMg: null,
        totalCarbohydrateGrams: 20,
        fiberGrams: null,
        sugarGrams: null,
        proteinGrams: 5,
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
    weight: null,
  };
}

function createPersistedClient(timestamp = Date.now(), queries: unknown[] = []) {
  return JSON.stringify({
    buster: DAY_LOG_CACHE_BUSTER,
    timestamp,
    clientState: { queries, mutations: [] },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("day-log cache persistence", () => {
  it("restores only the confirmed user's date-keyed Day Log entries", async () => {
    const { storage } = createStorage();
    const storageFactory = vi.fn(() => storage);
    const userAQueryClient = new QueryClient();
    const userBQueryClient = new QueryClient();

    await restoreDayLogCache(userAQueryClient, "user-a", { storageFactory, throttleTime: 0 });
    userAQueryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));

    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());

    await restoreDayLogCache(userBQueryClient, "user-b", { storageFactory, throttleTime: 0 });

    expect(userBQueryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storageFactory).toHaveBeenCalledWith("user-a");
    expect(storageFactory).toHaveBeenCalledWith("user-b");

    await clearDayLogCache(userAQueryClient, "user-a");
    await clearDayLogCache(userBQueryClient, "user-b");
  });

  it("persists date entries but excludes authentication and range query data", async () => {
    const { storage } = createStorage();
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage, throttleTime: 0 });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), null);
    queryClient.setQueryData(dayLogRangeQueryKey({ startDate: "2026-08-22", endDate: "2026-08-22" }), {
      startDate: "2026-08-22",
      endDate: "2026-08-22",
      days: [{ date: "2026-08-22", dayLog: null }],
    });
    queryClient.setQueryData(["authenticatedSession"], { user: { id: "user-a" } });

    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());

    const persisted = JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? "{}");
    expect(persisted.clientState.queries).toHaveLength(1);
    expect(persisted.clientState.queries[0].queryKey).toEqual(dayLogQueryKey("2026-08-22"));
    expect(persisted.clientState.queries[0].state.data).toBeNull();
  });

  it("preserves a Known-empty day separately from an Empty Day Log", async () => {
    const { storage } = createStorage();
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage, throttleTime: 0 });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), null);
    queryClient.setQueryData(dayLogQueryKey("2026-08-23"), createDayLog("2026-08-23", 0));

    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());

    const restoredQueryClient = new QueryClient();
    await restoreDayLogCache(restoredQueryClient, "user-a", {
      storageFactory: () => storage,
      throttleTime: 0,
    });

    expect(restoredQueryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeNull();
    expect(restoredQueryClient.getQueryData(dayLogQueryKey("2026-08-23"))).toEqual(
      createDayLog("2026-08-23", 0),
    );
  });

  it("treats unavailable storage as an empty online cache", async () => {
    const queryClient = new QueryClient();
    const storageFactory = vi.fn(() => {
      throw new Error("IndexedDB unavailable");
    });

    await expect(
      restoreDayLogCache(queryClient, "user-a", { storageFactory }),
    ).resolves.toBeUndefined();

    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toEqual(
      createDayLog("2026-08-22"),
    );
  });

  it("treats corrupt storage as an empty cache and removes the corrupt namespace", async () => {
    const { storage } = createStorage({ [dayLogCacheStorageKey("user-a")]: "not-json" });
    const queryClient = new QueryClient();

    await expect(
      restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage }),
    ).resolves.toBeUndefined();

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(dayLogCacheStorageKey("user-a"));
  });

  it("discards persisted data older than the thirty-day retention window", async () => {
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedClient(Date.now() - DAY_LOG_CACHE_MAX_AGE_MS - 1),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(dayLogCacheStorageKey("user-a"));
  });

  it("clears matching in-memory and persisted data after account change", async () => {
    const { storage } = createStorage();
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage, throttleTime: 0 });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));
    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());

    await restoreDayLogCache(queryClient, "user-b", { storageFactory: () => storage, throttleTime: 0 });

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(dayLogCacheStorageKey("user-a"));
  });

  it("clears the current namespace without throwing when storage removal fails", async () => {
    const { storage } = createStorage();
    storage.removeItem.mockRejectedValue(new Error("IndexedDB write denied"));
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));

    await expect(clearDayLogCache(queryClient, "user-a")).resolves.toBeUndefined();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
  });
});
