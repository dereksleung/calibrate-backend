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

type DayLogCacheOptions = {
  storageFactory?: (userId: string) => AsyncStringStorage | null | Promise<AsyncStringStorage | null>;
  throttleTime?: number;
};

type ActiveDayLogCache = {
  userId: string;
  persister?: ReturnType<typeof createAsyncStoragePersister>;
  unsubscribe?: () => void;
  waitForPendingPersists?: () => Promise<void>;
};

const activeCaches = new WeakMap<QueryClient, ActiveDayLogCache>();

export function dayLogCacheStorageKey(userId: string): string {
  return `${DAY_LOG_CACHE_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
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
  if (activeCache?.userId === userId) return;

  if (activeCache) {
    await clearDayLogCache(queryClient, activeCache.userId, options);
  } else {
    queryClient.removeQueries({ queryKey: DAY_LOG_QUERY_KEY_PREFIX });
  }

  const storage = await getStorage(options, userId);
  if (!storage) {
    activeCaches.set(queryClient, { userId });
    return;
  }

  const persister = createAsyncStoragePersister({
    storage,
    key: dayLogCacheStorageKey(userId),
    throttleTime: options.throttleTime,
  });

  try {
    const persistedClient = await persister.restoreClient();

    if (persistedClient) {
      if (!isUsablePersistedClient(persistedClient, Date.now())) {
        await persister.removeClient();
      } else {
        hydrate(queryClient, sanitizePersistedClientState(persistedClient.clientState));
      }
    }
  } catch {
    queryClient.removeQueries({ queryKey: DAY_LOG_QUERY_KEY_PREFIX });
    await removePersistedClient(persister);
  }

  const persistence = subscribeToPersistence(queryClient, persister);
  activeCaches.set(queryClient, { userId, persister, ...persistence });
}

export async function clearDayLogCache(
  queryClient: QueryClient,
  userId?: string,
  options: DayLogCacheOptions = {},
): Promise<void> {
  const activeCache = activeCaches.get(queryClient);
  const targetUserId = userId ?? activeCache?.userId;

  activeCache?.unsubscribe?.();
  await activeCache?.waitForPendingPersists?.();
  activeCaches.delete(queryClient);
  queryClient.removeQueries({ queryKey: DAY_LOG_QUERY_KEY_PREFIX });

  if (!targetUserId) return;

  if (activeCache?.userId === targetUserId && activeCache.persister) {
    await removePersistedClient(activeCache.persister);
    return;
  }

  const storage = await getStorage(options, targetUserId);
  if (!storage) return;

  await removePersistedClient(
    createAsyncStoragePersister({
      storage,
      key: dayLogCacheStorageKey(targetUserId),
      throttleTime: options.throttleTime,
    }),
  );
}

function subscribeToPersistence(
  queryClient: QueryClient,
  persister: ActiveDayLogCache["persister"],
): Pick<ActiveDayLogCache, "unsubscribe" | "waitForPendingPersists"> {
  if (!persister) {
    return {
      unsubscribe: () => undefined,
      waitForPendingPersists: async () => undefined,
    };
  }

  let active = true;
  const pendingPersists = new Set<Promise<void>>();

  const persist = () => {
    if (!active) return;

    const pendingPersist = Promise.resolve().then(() =>
      persister.persistClient({
        buster: DAY_LOG_CACHE_BUSTER,
        timestamp: Date.now(),
        clientState: dehydrate(queryClient, dehydrateOptions),
      }),
    );
    pendingPersists.add(pendingPersist);
    void pendingPersist.then(
      () => pendingPersists.delete(pendingPersist),
      () => pendingPersists.delete(pendingPersist),
    );
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "added" || event.type === "removed" || event.type === "updated") {
      persist();
    }
  });

  return {
    unsubscribe: () => {
      active = false;
      unsubscribe();
    },
    waitForPendingPersists: async () => {
      while (pendingPersists.size > 0) {
        await Promise.all(
          [...pendingPersists].map((pendingPersist) => pendingPersist.catch(() => undefined)),
        );
      }
    },
  };
}

async function getStorage(options: DayLogCacheOptions, userId: string): Promise<AsyncStringStorage | null> {
  try {
    if (options.storageFactory) return await options.storageFactory(userId);
    return createIndexedDbStorage();
  } catch {
    return null;
  }
}

function isUsablePersistedClient(value: unknown, now: number): value is PersistedDayLogClient {
  if (!value || typeof value !== "object") return false;

  const persistedClient = value as Partial<PersistedDayLogClient>;
  return (
    persistedClient.buster === DAY_LOG_CACHE_BUSTER &&
    typeof persistedClient.timestamp === "number" &&
    Number.isFinite(persistedClient.timestamp) &&
    now - persistedClient.timestamp <= DAY_LOG_CACHE_MAX_AGE_MS &&
    Boolean(persistedClient.clientState) &&
    typeof persistedClient.clientState === "object" &&
    Array.isArray(persistedClient.clientState.queries) &&
    Array.isArray(persistedClient.clientState.mutations)
  );
}

function sanitizePersistedClientState(clientState: DehydratedState): DehydratedState {
  const queries = clientState.queries.filter((query) => {
    if (!isPersistableDayLogQuery(query) || query.state.status !== "success") return false;

    if (query.state.data !== null && !DayLogResponseSchema.safeParse(query.state.data).success) {
      throw new Error("Persisted Day Log cache contains invalid data");
    }

    return true;
  });

  return {
    ...clientState,
    queries,
    mutations: [],
  };
}

async function removePersistedClient(persister: NonNullable<ActiveDayLogCache["persister"]>): Promise<void> {
  try {
    await persister.removeClient();
  } catch {
    // Storage is an optional performance benefit. In-memory logout/account isolation still succeeds.
  }
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
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
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
