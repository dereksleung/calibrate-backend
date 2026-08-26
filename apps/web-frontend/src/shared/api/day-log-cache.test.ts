// @vitest-environment jsdom

import { dayLogQueryKey, dayLogRangeQueryKey } from "@calibrate/api-client";
import { dehydrate, QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    id: "00000000-0000-4000-8000-000000000001",
    date,
    breakfast: [
      {
        id: "00000000-0000-4000-8000-000000000002",
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

function createPersistedDayLogClient(
  entries: Array<{ queryDate: string; dataDate: string; dataUpdatedAt: number }>,
) {
  const queryClient = new QueryClient();
  for (const entry of entries) {
    queryClient.setQueryData(dayLogQueryKey(entry.queryDate), createDayLog(entry.dataDate), {
      updatedAt: entry.dataUpdatedAt,
    });
  }

  return JSON.stringify({
    buster: DAY_LOG_CACHE_BUSTER,
    timestamp: Date.now(),
    clientState: dehydrate(queryClient),
  });
}

class FakeBroadcastChannel {
  private static readonly channels = new Set<FakeBroadcastChannel>();
  private readonly listeners = new Set<(event: { data: unknown }) => void>();
  private closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.channels.add(this);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    if (type === "message") this.listeners.add(listener);
  }

  postMessage(data: unknown): void {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;

      queueMicrotask(() => {
        if (channel.closed) return;
        for (const listener of channel.listeners) listener({ data });
      });
    }
  }

  close(): void {
    this.closed = true;
    FakeBroadcastChannel.channels.delete(this);
  }

  static reset(): void {
    for (const channel of FakeBroadcastChannel.channels) channel.close();
  }
}

afterEach(() => {
  cleanup();
  FakeBroadcastChannel.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("day-log cache persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });
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

  it("does not persist unrelated query cache changes", async () => {
    const { storage } = createStorage();
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage, throttleTime: 0 });
    storage.setItem.mockClear();

    queryClient.setQueryData(["authenticatedSession"], { user: { id: "user-a" } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storage.setItem).not.toHaveBeenCalled();

    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), null);
    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());
  });

  it("never hydrates authentication state from a persisted namespace", async () => {
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedClient(Date.now(), [
        { queryKey: ["authenticatedSession"], state: { data: { user: { id: "user-a" } } } },
      ]),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    expect(queryClient.getQueryData(["authenticatedSession"])).toBeUndefined();
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

    await expect(restoreDayLogCache(queryClient, "user-a", { storageFactory })).resolves.toBeUndefined();

    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toEqual(createDayLog("2026-08-22"));
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
    const now = Date.now();
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        {
          queryDate: "2026-08-22",
          dataDate: "2026-08-22",
          dataUpdatedAt: now - DAY_LOG_CACHE_MAX_AGE_MS - 1,
        },
      ]),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(dayLogCacheStorageKey("user-a"));
  });

  it("retains fresh entries while dropping only expired entries during restore", async () => {
    const now = Date.now();
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        {
          queryDate: "2026-08-21",
          dataDate: "2026-08-21",
          dataUpdatedAt: now - DAY_LOG_CACHE_MAX_AGE_MS - 1,
        },
        { queryDate: "2026-08-22", dataDate: "2026-08-22", dataUpdatedAt: now },
      ]),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-21"))).toBeUndefined();
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toEqual(createDayLog("2026-08-22"));
  });

  it("rewrites the persisted namespace without expired entries during restore", async () => {
    const now = Date.now();
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        {
          queryDate: "2026-08-21",
          dataDate: "2026-08-21",
          dataUpdatedAt: now - DAY_LOG_CACHE_MAX_AGE_MS - 1,
        },
        { queryDate: "2026-08-22", dataDate: "2026-08-22", dataUpdatedAt: now },
      ]),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());
    const rewritten = JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? "{}");
    expect(rewritten.clientState.queries.map((query: { queryKey: unknown }) => query.queryKey)).toEqual([
      dayLogQueryKey("2026-08-22"),
    ]);
  });

  it("discards persisted entries with future update timestamps", async () => {
    const now = Date.now();
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        {
          queryDate: "2026-08-22",
          dataDate: "2026-08-22",
          dataUpdatedAt: now + DAY_LOG_CACHE_MAX_AGE_MS,
        },
      ]),
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalledWith(dayLogCacheStorageKey("user-a"));
  });

  it("rejects a persisted Day Log whose date does not match its query key", async () => {
    const { storage } = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        {
          queryDate: "2026-08-22",
          dataDate: "2026-08-23",
          dataUpdatedAt: Date.now(),
        },
      ]),
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

  it("waits for an in-flight write in another browser tab before clearing the namespace", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const sharedStorage = createStorage();
    const firstTab = new QueryClient();
    const secondTab = new QueryClient();
    const options = { storageFactory: () => sharedStorage.storage, throttleTime: 0 };
    const queryKey = dayLogQueryKey("2026-08-22");

    await restoreDayLogCache(firstTab, "user-a", options);
    await restoreDayLogCache(secondTab, "user-a", options);
    firstTab.setQueryData(queryKey, createDayLog("2026-08-22"));
    await waitFor(() => expect(sharedStorage.entries.has(dayLogCacheStorageKey("user-a"))).toBe(true));

    let releaseWrite!: () => void;
    let resolveWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      resolveWriteStarted = resolve;
    });
    const writeFinished = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    sharedStorage.storage.setItem.mockImplementation(async (key, value) => {
      resolveWriteStarted();
      await writeFinished;
      sharedStorage.entries.set(key, value);
    });
    secondTab.setQueryData(queryKey, createDayLog("2026-08-22", 240));
    await writeStarted;

    await clearDayLogCache(firstTab, "user-a", options);

    releaseWrite();
    await waitFor(() => expect(secondTab.getQueryData(queryKey)).toBeUndefined());
    expect(firstTab.getQueryData(queryKey)).toBeUndefined();
    expect(sharedStorage.entries.has(dayLogCacheStorageKey("user-a"))).toBe(false);
  });

  it("preserves the current cache and surfaces storage removal failures", async () => {
    const { storage } = createStorage();
    storage.removeItem.mockRejectedValue(new Error("IndexedDB write denied"));
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), createDayLog("2026-08-22"));

    await expect(clearDayLogCache(queryClient, "user-a")).rejects.toThrow("IndexedDB write denied");
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toEqual(createDayLog("2026-08-22"));
  });

  it("surfaces storage acquisition failures while clearing a namespace", async () => {
    const queryClient = new QueryClient();
    const storageError = new Error("IndexedDB unavailable");

    await expect(
      clearDayLogCache(queryClient, "user-a", {
        storageFactory: async () => {
          throw storageError;
        },
      }),
    ).rejects.toThrow("IndexedDB unavailable");
  });

  it("retries storage cleanup when restoration could not access the namespace", async () => {
    const storageKey = dayLogCacheStorageKey("user-a");
    const { entries, storage } = createStorage({ [storageKey]: "private-day-log-cache" });
    let storageAvailable = false;
    const storageFactory = vi.fn(() => (storageAvailable ? storage : null));
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory });
    storageAvailable = true;

    await clearDayLogCache(queryClient, "user-a", { storageFactory });

    expect(entries.has(storageKey)).toBe(false);
  });

  it("does not hydrate an older user's pending restore after a newer restore starts", async () => {
    const userA = createStorage({
      [dayLogCacheStorageKey("user-a")]: createPersistedDayLogClient([
        { queryDate: "2026-08-22", dataDate: "2026-08-22", dataUpdatedAt: Date.now() },
      ]),
    });
    const userB = createStorage();
    let releaseUserAStorage!: () => void;
    const userAStorageReady = new Promise<typeof userA.storage>((resolve) => {
      releaseUserAStorage = () => resolve(userA.storage);
    });
    const storageFactory = vi.fn((userId: string) =>
      userId === "user-a" ? userAStorageReady : userB.storage,
    );
    const queryClient = new QueryClient();

    const restoreUserA = restoreDayLogCache(queryClient, "user-a", { storageFactory });
    await waitFor(() => expect(storageFactory).toHaveBeenCalledWith("user-a"));

    const restoreUserB = restoreDayLogCache(queryClient, "user-b", { storageFactory });
    releaseUserAStorage();
    await Promise.all([restoreUserA, restoreUserB]);

    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toBeUndefined();
  });

  it("waits for a restore rewrite before clearing its persisted namespace", async () => {
    const storageKey = dayLogCacheStorageKey("user-a");
    const { entries, storage } = createStorage({
      [storageKey]: createPersistedDayLogClient([
        { queryDate: "2026-08-22", dataDate: "2026-08-22", dataUpdatedAt: Date.now() },
      ]),
    });
    let releaseWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    storage.setItem.mockImplementation(async (key, value) => {
      await writeFinished;
      entries.set(key, value);
    });
    const queryClient = new QueryClient();

    const restorePromise = restoreDayLogCache(queryClient, "user-a", {
      storageFactory: () => storage,
      throttleTime: 0,
    });
    await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith(storageKey, expect.any(String)));

    const clearPromise = clearDayLogCache(queryClient, "user-a", {
      storageFactory: () => storage,
    });
    expect(storage.removeItem).not.toHaveBeenCalled();

    releaseWrite();
    await Promise.all([restorePromise, clearPromise]);

    expect(entries.has(storageKey)).toBe(false);
  });

  it("waits for an in-flight persistence write before clearing the namespace", async () => {
    const { entries, storage } = createStorage();
    const storageKey = dayLogCacheStorageKey("user-a");
    let releaseWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    storage.setItem.mockImplementation(async (key, value) => {
      await writeFinished;
      entries.set(key, value);
    });
    const queryClient = new QueryClient();

    await restoreDayLogCache(queryClient, "user-a", { storageFactory: () => storage });
    queryClient.setQueryData(dayLogQueryKey("2026-08-22"), null);
    await waitFor(() => expect(storage.setItem).toHaveBeenCalledWith(storageKey, expect.any(String)));

    const clearPromise = clearDayLogCache(queryClient, "user-a");
    expect(storage.removeItem).not.toHaveBeenCalled();

    releaseWrite();
    await clearPromise;

    expect(storage.removeItem).toHaveBeenCalledWith(storageKey);
    expect(entries.has(storageKey)).toBe(false);
  });

  it("publishes restored Day Logs before a delayed persistence rewrite commits", async () => {
    const storageKey = dayLogCacheStorageKey("user-a");
    const { entries, storage } = createStorage({
      [storageKey]: createPersistedDayLogClient([
        { queryDate: "2026-08-22", dataDate: "2026-08-22", dataUpdatedAt: Date.now() },
      ]),
    });
    let releaseWrite!: () => void;
    let resolveWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      resolveWriteStarted = resolve;
    });
    const writeFinished = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    storage.setItem.mockImplementation(async (key, value) => {
      resolveWriteStarted();
      await writeFinished;
      entries.set(key, value);
    });
    const queryClient = new QueryClient();

    const restorePromise = restoreDayLogCache(queryClient, "user-a", {
      storageFactory: () => storage,
      throttleTime: 0,
    });
    await writeStarted;

    await restorePromise;
    expect(queryClient.getQueryData(dayLogQueryKey("2026-08-22"))).toEqual(createDayLog("2026-08-22"));

    releaseWrite();
    await waitFor(() => expect(entries.get(storageKey)).toEqual(expect.any(String)));
  });

  it("clears mounted Day Log observers when another tab logs out", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const queryKey = dayLogQueryKey("2026-08-22");
    const { storage } = createStorage();
    const firstTab = new QueryClient();
    const secondTab = new QueryClient();
    const options = { storageFactory: () => storage, throttleTime: 0 };
    const onRemoteClear = vi.fn();

    await restoreDayLogCache(firstTab, "user-a", options);
    await restoreDayLogCache(secondTab, "user-a", { ...options, onRemoteClear });
    secondTab.setQueryData(queryKey, createDayLog("2026-08-22"));

    function DayLogObserver() {
      const { data } = useQuery({
        queryKey,
        queryFn: skipToken,
        staleTime: Infinity,
      });
      return createElement("p", null, data === undefined ? "cleared" : "visible");
    }

    render(createElement(QueryClientProvider, { client: secondTab }, createElement(DayLogObserver)));
    expect(screen.getByText("visible")).toBeTruthy();

    await clearDayLogCache(firstTab, "user-a", options);

    await waitFor(() => expect(screen.getByText("cleared")).toBeTruthy());
    expect(secondTab.getQueryData(queryKey)).toBeUndefined();
    expect(onRemoteClear).toHaveBeenCalledTimes(1);
  });

  it("retries a failed cross-tab persistence cleanup until the namespace is removed", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const storageKey = dayLogCacheStorageKey("user-a");
    const { entries, storage } = createStorage();
    const firstTab = new QueryClient();
    const secondTab = new QueryClient();
    const options = { storageFactory: () => storage, throttleTime: 0 };
    const queryKey = dayLogQueryKey("2026-08-22");

    await restoreDayLogCache(firstTab, "user-a", options);
    await restoreDayLogCache(secondTab, "user-a", options);
    firstTab.setQueryData(queryKey, createDayLog("2026-08-22"));
    secondTab.setQueryData(queryKey, createDayLog("2026-08-22", 240));
    await waitFor(() => expect(entries.has(storageKey)).toBe(true));

    let removeAttempts = 0;
    storage.removeItem.mockImplementation(async (key) => {
      removeAttempts += 1;
      if (removeAttempts === 2) throw new Error("IndexedDB write denied");
      entries.delete(key);
    });

    await clearDayLogCache(firstTab, "user-a", options);

    await waitFor(() => expect(secondTab.getQueryData(queryKey)).toBeUndefined());
    expect(firstTab.getQueryData(queryKey)).toBeUndefined();
    expect(entries.has(storageKey)).toBe(false);
    expect(removeAttempts).toBeGreaterThanOrEqual(3);
  });
});
