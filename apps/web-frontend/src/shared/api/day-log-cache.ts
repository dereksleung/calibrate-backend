import { DayLogResponseSchema } from "@calibrate/api-contracts";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";

export const DAY_LOG_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const DAY_LOG_CACHE_BUSTER = "day-log-cache-v1";

const DAY_LOG_CACHE_DATABASE_NAME = "calibrate-day-log-cache";
const DAY_LOG_CACHE_STORE_NAME = "query-cache";
const DAY_LOG_CACHE_STORAGE_PREFIX = "calibrate:day-logs:";
const DAY_LOG_CACHE_INVALIDATION_CHANNEL = "calibrate-day-log-cache-invalidation";
const DAY_LOG_QUERY_SCOPE = "dayLogs";
const DAY_LOG_QUERY_KEY_PREFIX = [DAY_LOG_QUERY_SCOPE] as const;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AsyncStringStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type PersistedDayLogClient = {
  buster: string;
  timestamp: number;
  clientState: DehydratedState;
};

type PendingPersistenceTracker = {
  track: (operation: () => Promise<void>) => Promise<void>;
  wait: () => Promise<void>;
};

type DayLogCacheOptions = {
  storageFactory?: (userId: string) => AsyncStringStorage | null | Promise<AsyncStringStorage | null>;
  throttleTime?: number;
  isCurrentUser?: () => boolean;
  broadcast?: boolean;
  onRemoteClear?: () => void | Promise<void>;
};

type ActiveDayLogCache = {
  userId: string;
  persister?: ReturnType<typeof createAsyncStoragePersister>;
  ready?: Promise<void>;
  clearPersisted?: () => Promise<void>;
  unsubscribe?: () => void;
  waitForPendingPersists?: () => Promise<void>;
  invalidationChannel?: BroadcastChannel;
};

const activeCaches = new WeakMap<QueryClient, ActiveDayLogCache>();
const cacheGenerations = new WeakMap<QueryClient, number>();
const persistedNamespaceCleanups = new Map<string, Promise<void>>();
const PERSISTED_NAMESPACE_CLEAR_ATTEMPTS = 3;

export function dayLogCacheStorageKey(userId: string): string {
  return `${DAY_LOG_CACHE_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

export function createDayLogCacheWriteGuard(queryClient: QueryClient, userId: string): () => boolean {
  const generation = cacheGenerations.get(queryClient);
  return () =>
    generation !== undefined &&
    isCurrentCacheGeneration(queryClient, generation) &&
    activeCaches.get(queryClient)?.userId === userId;
}

export function isPersistableDayLogQuery(query: Pick<Query, "queryKey">): boolean {
  const [scope, date, ...rest] = query.queryKey;
  return (
    scope === DAY_LOG_QUERY_SCOPE &&
    rest.length === 0 &&
    typeof date === "string" &&
    ISO_DATE_PATTERN.test(date)
  );
}

const shouldDehydrateQuery = (query: Query) =>
  isPersistableDayLogQuery(query) && query.state.status === "success";

const dehydrateOptions = {
  shouldDehydrateQuery,
  shouldDehydrateMutation: () => false,
};

export async function restoreDayLogCache(
  queryClient: QueryClient,
  userId: string,
  options: DayLogCacheOptions = {},
): Promise<void> {
  queryClient.setQueryDefaults(DAY_LOG_QUERY_KEY_PREFIX, {
    // A 30-day timeout exceeds the browser's 32-bit timer limit. Infinity keeps
    // restored entries available in memory for at least the persisted retention window.
    gcTime: Infinity,
  });

  const activeCache = activeCaches.get(queryClient);
  if (activeCache?.userId === userId) {
    await activeCache.ready;
    return;
  }
  const generation = nextCacheGeneration(queryClient);
  const isCurrent = () => isCurrentCacheOperation(queryClient, generation, options);

  if (activeCache) {
    await clearActiveCache(queryClient, activeCache, isCurrent);
  } else {
    resetAndRemoveDayLogQueries(queryClient);
  }

  if (!isCurrent()) return;
  if (activeCache) {
    broadcastDayLogCacheInvalidation(activeCache.invalidationChannel, activeCache.userId);
    activeCache.invalidationChannel?.close();
  }

  const storage = await getStorage(options, userId);
  if (!isCurrent()) return;
  if (!storage) {
    activeCaches.set(queryClient, {
      userId,
      clearPersisted: () => clearPersistedNamespace(options, userId),
      invalidationChannel: createDayLogCacheInvalidationChannel(queryClient, userId, options),
    });
    return;
  }

  const persister = createAsyncStoragePersister({
    storage,
    key: dayLogCacheStorageKey(userId),
    throttleTime: options.throttleTime,
  });
  const pendingPersistence = createPendingPersistenceTracker();
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const restoringCache: ActiveDayLogCache = {
    userId,
    persister,
    ready,
    clearPersisted: () => clearPersistedNamespace(options, userId),
    waitForPendingPersists: pendingPersistence.wait,
    invalidationChannel: createDayLogCacheInvalidationChannel(queryClient, userId, options),
  };
  activeCaches.set(queryClient, restoringCache);

  try {
    try {
      const persistedClient = await persister.restoreClient();
      if (!isCurrent()) return;

      if (persistedClient) {
        if (!isUsablePersistedClient(persistedClient)) {
          await discardPersistedClient(persister);
        } else {
          const sanitizedState = sanitizePersistedClientState(persistedClient.clientState, Date.now());
          if (!isCurrent()) return;
          if (sanitizedState.queries.length === 0) {
            await discardPersistedClient(persister);
          } else {
            hydrate(queryClient, sanitizedState);
            if (!isCurrent()) return;
            void pendingPersistence.track(async () => {
              await persister.persistClient({
                buster: DAY_LOG_CACHE_BUSTER,
                timestamp: Date.now(),
                clientState: sanitizedState,
              });
            });
          }
        }
      }
    } catch {
      if (!isCurrent()) return;
      resetAndRemoveDayLogQueries(queryClient);
      await discardPersistedClient(persister);
    }

    if (!isCurrent()) return;
    const persistence = subscribeToPersistence(queryClient, persister, pendingPersistence);
    activeCaches.set(queryClient, { ...restoringCache, ...persistence });
  } finally {
    resolveReady();
  }
}

export async function clearDayLogCache(
  queryClient: QueryClient,
  userId?: string,
  options: DayLogCacheOptions = {},
): Promise<void> {
  const activeCache = activeCaches.get(queryClient);
  const targetUserId = userId ?? activeCache?.userId;
  const shouldBroadcast = options.broadcast ?? true;

  const generation = nextCacheGeneration(queryClient);
  const isCurrent = () => isCurrentCacheGeneration(queryClient, generation);

  if (activeCache && activeCache.userId === targetUserId) {
    await clearActiveCache(queryClient, activeCache, isCurrent);
    if (shouldBroadcast && isCurrent()) {
      broadcastDayLogCacheInvalidation(activeCache.invalidationChannel, activeCache.userId);
    }
    activeCache.invalidationChannel?.close();
    return;
  }

  if (!targetUserId) {
    if (isCurrent()) resetAndRemoveDayLogQueries(queryClient);
    return;
  }

  await clearPersistedNamespace(options, targetUserId);
  if (!isCurrent()) return;

  if (!activeCache && isCurrent()) resetAndRemoveDayLogQueries(queryClient);
  if (shouldBroadcast && isCurrent() && targetUserId) {
    broadcastDayLogCacheInvalidation(undefined, targetUserId);
  }
}

async function clearActiveCache(
  queryClient: QueryClient,
  activeCache: ActiveDayLogCache,
  canContinue: () => boolean,
): Promise<void> {
  activeCache.unsubscribe?.();
  await activeCache.waitForPendingPersists?.();
  if (!canContinue() || activeCaches.get(queryClient) !== activeCache) return;

  if (activeCache.clearPersisted) {
    await activeCache.clearPersisted();
  } else if (activeCache.persister) {
    await removePersistedClient(activeCache.persister);
  }
  if (!canContinue() || activeCaches.get(queryClient) !== activeCache) return;

  activeCaches.delete(queryClient);
  resetAndRemoveDayLogQueries(queryClient);
}

function subscribeToPersistence(
  queryClient: QueryClient,
  persister: ActiveDayLogCache["persister"],
  pendingPersistence: PendingPersistenceTracker,
): Pick<ActiveDayLogCache, "unsubscribe" | "waitForPendingPersists"> {
  if (!persister) {
    return {
      unsubscribe: () => undefined,
      waitForPendingPersists: async () => undefined,
    };
  }

  let active = true;

  const persist = () => {
    if (!active) return;

    void pendingPersistence.track(async () => {
      await persister.persistClient({
        buster: DAY_LOG_CACHE_BUSTER,
        timestamp: Date.now(),
        clientState: dehydrate(queryClient, dehydrateOptions),
      });
    });
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      (event.type === "added" || event.type === "removed" || event.type === "updated") &&
      isPersistableDayLogQuery(event.query)
    ) {
      persist();
    }
  });

  return {
    unsubscribe: () => {
      active = false;
      unsubscribe();
    },
    waitForPendingPersists: pendingPersistence.wait,
  };
}

function createDayLogCacheInvalidationChannel(
  queryClient: QueryClient,
  userId: string,
  options: DayLogCacheOptions,
): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;

  try {
    const channel = new BroadcastChannel(DAY_LOG_CACHE_INVALIDATION_CHANNEL);
    channel.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (!isDayLogCacheInvalidationMessage(event.data, userId)) return;

      void applyRemoteDayLogCacheClear(queryClient, userId, options);
    });
    return channel;
  } catch {
    return undefined;
  }
}

async function applyRemoteDayLogCacheClear(
  queryClient: QueryClient,
  userId: string,
  options: DayLogCacheOptions,
): Promise<void> {
  const activeCache = activeCaches.get(queryClient);
  const generation = nextCacheGeneration(queryClient);
  const isCurrent = () => isCurrentCacheGeneration(queryClient, generation);

  try {
    if (activeCache && activeCache.userId === userId) {
      activeCache.unsubscribe?.();
      await activeCache.waitForPendingPersists?.();
      if (!isCurrent() || activeCaches.get(queryClient) !== activeCache) return;

      try {
        await retryClearPersistedNamespace(options, userId);
      } finally {
        if (isCurrent() && activeCaches.get(queryClient) === activeCache) {
          activeCaches.delete(queryClient);
          resetAndRemoveDayLogQueries(queryClient);
        }
        activeCache.invalidationChannel?.close();
      }
      return;
    }

    await retryClearPersistedNamespace(options, userId);
    if (isCurrent() && !activeCaches.get(queryClient)) {
      resetAndRemoveDayLogQueries(queryClient);
    }
  } finally {
    if (isCurrent()) await options.onRemoteClear?.();
  }
}

function broadcastDayLogCacheInvalidation(channel: BroadcastChannel | undefined, userId: string): void {
  let sender = channel;
  let closeSender = false;

  if (!sender && typeof BroadcastChannel !== "undefined") {
    try {
      sender = new BroadcastChannel(DAY_LOG_CACHE_INVALIDATION_CHANNEL);
      closeSender = true;
    } catch {
      return;
    }
  }

  if (!sender) return;

  try {
    sender.postMessage({ type: "clear", userId });
  } catch {
    return;
  } finally {
    if (closeSender) sender.close();
  }
}

function isDayLogCacheInvalidationMessage(value: unknown, userId: string): boolean {
  if (!value || typeof value !== "object") return false;

  const message = value as { type?: unknown; userId?: unknown };
  return message.type === "clear" && message.userId === userId;
}

async function getStorage(
  options: DayLogCacheOptions,
  userId: string,
  surfaceFailure = false,
): Promise<AsyncStringStorage | null> {
  try {
    if (options.storageFactory) return await options.storageFactory(userId);
    return createIndexedDbStorage();
  } catch (error) {
    if (surfaceFailure) throw error;
    return null;
  }
}

async function clearPersistedNamespace(options: DayLogCacheOptions, userId: string): Promise<void> {
  const key = dayLogCacheStorageKey(userId);
  const inFlight = persistedNamespaceCleanups.get(key);
  if (inFlight) {
    await inFlight;
    return;
  }

  const cleanup = (async () => {
    const storage = await getStorage(options, userId, true);
    if (!storage) return;

    await removePersistedClient(
      createAsyncStoragePersister({
        storage,
        key,
        throttleTime: options.throttleTime,
      }),
    );
  })();

  persistedNamespaceCleanups.set(key, cleanup);
  try {
    await cleanup;
  } finally {
    if (persistedNamespaceCleanups.get(key) === cleanup) {
      persistedNamespaceCleanups.delete(key);
    }
  }
}

async function retryClearPersistedNamespace(options: DayLogCacheOptions, userId: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < PERSISTED_NAMESPACE_CLEAR_ATTEMPTS; attempt += 1) {
    try {
      await clearPersistedNamespace(options, userId);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function resetAndRemoveDayLogQueries(queryClient: QueryClient): void {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: DAY_LOG_QUERY_KEY_PREFIX })) {
    if (isPersistableDayLogQuery(query)) query.reset();
  }
  queryClient.removeQueries({ queryKey: DAY_LOG_QUERY_KEY_PREFIX });
}

function createPendingPersistenceTracker(): PendingPersistenceTracker {
  const pendingPersists = new Set<Promise<void>>();

  const track = (operation: () => Promise<void>): Promise<void> => {
    const pendingPersist = Promise.resolve().then(operation);
    pendingPersists.add(pendingPersist);
    void pendingPersist.then(
      () => pendingPersists.delete(pendingPersist),
      () => pendingPersists.delete(pendingPersist),
    );
    return pendingPersist;
  };

  const wait = async (): Promise<void> => {
    while (pendingPersists.size > 0) {
      await Promise.all([...pendingPersists].map((pendingPersist) => pendingPersist.catch(() => undefined)));
    }
  };

  return { track, wait };
}

function isUsablePersistedClient(value: unknown): value is PersistedDayLogClient {
  if (!value || typeof value !== "object") return false;

  const persistedClient = value as Partial<PersistedDayLogClient>;
  return (
    persistedClient.buster === DAY_LOG_CACHE_BUSTER &&
    typeof persistedClient.timestamp === "number" &&
    Number.isFinite(persistedClient.timestamp) &&
    Boolean(persistedClient.clientState) &&
    typeof persistedClient.clientState === "object" &&
    Array.isArray(persistedClient.clientState.queries) &&
    Array.isArray(persistedClient.clientState.mutations)
  );
}

function sanitizePersistedClientState(clientState: DehydratedState, now: number): DehydratedState {
  const queries = clientState.queries.filter((query) => {
    if (!isPersistableDayLogQuery(query) || query.state.status !== "success") return false;

    if (query.state.data !== null) {
      const parsedDayLog = DayLogResponseSchema.safeParse(query.state.data);
      const [, date] = query.queryKey;
      if (!parsedDayLog.success || parsedDayLog.data === null || parsedDayLog.data.date !== date) {
        throw new Error("Persisted Day Log cache contains invalid data");
      }
    }

    return isWithinRetentionWindow(query, now);
  });

  return {
    ...clientState,
    queries,
    mutations: [],
  };
}

async function removePersistedClient(persister: NonNullable<ActiveDayLogCache["persister"]>): Promise<void> {
  await persister.removeClient();
}

async function discardPersistedClient(persister: NonNullable<ActiveDayLogCache["persister"]>): Promise<void> {
  try {
    await removePersistedClient(persister);
  } catch {
    return;
  }
}

function isWithinRetentionWindow(query: { state: { dataUpdatedAt: number } }, now: number): boolean {
  const dataUpdatedAt = query.state.dataUpdatedAt;
  return (
    typeof dataUpdatedAt === "number" &&
    Number.isFinite(dataUpdatedAt) &&
    dataUpdatedAt <= now &&
    now - dataUpdatedAt <= DAY_LOG_CACHE_MAX_AGE_MS
  );
}

function nextCacheGeneration(queryClient: QueryClient): number {
  const generation = (cacheGenerations.get(queryClient) ?? 0) + 1;
  cacheGenerations.set(queryClient, generation);
  return generation;
}

function isCurrentCacheGeneration(queryClient: QueryClient, generation: number): boolean {
  return cacheGenerations.get(queryClient) === generation;
}

function isCurrentCacheOperation(
  queryClient: QueryClient,
  generation: number,
  options: DayLogCacheOptions,
): boolean {
  return isCurrentCacheGeneration(queryClient, generation) && (options.isCurrentUser?.() ?? true);
}

function createIndexedDbStorage(): AsyncStringStorage | null {
  if (typeof indexedDB === "undefined") return null;

  return {
    getItem: async (key) => {
      const value = await runStoreRequest<string | undefined>("readonly", (store) => store.get(key));
      return value ?? null;
    },
    setItem: async (key, value) => {
      await runStoreRequest("readwrite", (store) => store.put(value, key));
    },
    removeItem: async (key) => {
      await runStoreRequest("readwrite", (store) => store.delete(key));
    },
  };
}

async function runStoreRequest<T>(
  mode: IDBTransactionMode,
  requestFactory: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(DAY_LOG_CACHE_STORE_NAME, mode);
    const request = requestFactory(transaction.objectStore(DAY_LOG_CACHE_STORE_NAME));

    return await new Promise<T>((resolve, reject) => {
      let requestResult!: T;
      request.onsuccess = () => {
        requestResult = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      transaction.oncomplete = () => resolve(requestResult);
    });
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DAY_LOG_CACHE_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DAY_LOG_CACHE_STORE_NAME)) {
        request.result.createObjectStore(DAY_LOG_CACHE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}
