# Day-log cache and conditional revalidation research

_Researched 2026-08-22. External sources in this note are primary sources: TanStack Query's official documentation and the HTTP RFCs._

## Answer in brief

Yes, the browser can persist a TanStack Query cache in IndexedDB, and the query cache can hold one date-indexed entry per day even when a single range request supplies the data. TanStack documents both a generic asynchronous persister interface and an IndexedDB implementation example. A range-response handler can seed or replace each individual day entry with `queryClient.setQueryData`.

Standard HTTP conditional GET is also applicable, but to the **range response as one representation**. `GET /daylogs?startDate=…&endDate=…` can emit one ETag that represents the complete response for that authenticated user and exact date range. On the next identical request, `If-None-Match` can yield `304 Not Modified` when the complete range is unchanged. That is a good first conditional-revalidation design.

Standard `If-None-Match` does **not** express "date A has revision x and date B has revision y; return only the dates whose revisions differ." Its tag list is an OR comparison against the entity tag of the single selected representation. A per-day version manifest is possible, but it is an application-specific synchronization protocol, not an HTTP conditional GET. It only improves backend work when the server can validate it using cheaper metadata than loading and serializing the complete range.

## Current codebase baseline

- `GET /api/v1/daylogs?startDate&endDate` already returns every requested date slot, including `dayLog: null` for dates without a log. The client currently caches that result under a range-specific key (`["dayLogs", "range", startDate, endDate]`), while an individual-day read has a different key (`["dayLogs", date]`). See `packages/api-client/src/day-logs/get-day-log-range.ts` and `packages/api-client/src/day-logs/get-day-log.ts`.
- `apps/web-frontend/src/main.tsx` uses `QueryClientProvider`; `apps/web-frontend/src/shared/api/query-client.ts` does not yet configure persistence.
- The workspace has `@tanstack/react-query`, but not the official persistence packages documented below. An implementation that uses them would therefore require an explicit dependency-install decision. This research task made no dependency or production-code changes.

## 1. Persisting date-indexed query data to IndexedDB

### What TanStack supports

TanStack's persistence mechanism stores and restores a **dehydrated QueryClient** through a `Persister` with `persistClient`, `restoreClient`, and `removeClient`. The official documentation includes an IndexedDB persister example and recommends the persistence provider so mounting queries do not race the asynchronous restore. It also warns that the query client's `gcTime` must be at least the persistence `maxAge`; otherwise hydrated entries can be collected sooner than intended. [TanStack: persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)

The documented persistence package is `@tanstack/react-query-persist-client`; `createAsyncStoragePersister` is supplied by the separate `@tanstack/query-async-storage-persister` package. The latter takes any storage with the async-storage interface, but TanStack's own IndexedDB example instead builds the general `Persister` interface with an IndexedDB wrapper. [TanStack: createAsyncStoragePersister](https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister)

The important distinction is that persistence saves the dehydrated cache as a whole; it does not independently configure a storage record per TanStack key. That is still compatible with per-day query keys: each per-day query becomes an independently addressable cache entry before dehydration, and then the persister saves the resulting client state.

### Normalizing a fetched range into one cache entry per day

TanStack requires serializable, data-unique array query keys and explicitly supports variables such as an identifier in a key. `queryClient.setQueryData` synchronously creates or updates a cache entry for a key from data already held by the application. These APIs support this sequence:

1. Fetch a seven-day range once.
2. For every returned date slot, write a value (including an explicit `null` slot) under a per-day key.
3. Render a date range by composing those day entries, rather than treating the range payload as the durable cache shape.

That is a supported cache operation; immutable updates are required. [TanStack: query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [TanStack: QueryClient cache APIs](https://tanstack.com/query/latest/docs/reference/QueryClient)

Suggested **identity shape to decide during design**, not an implementation commitment:

```ts
['dayLogs', accountId, yyyyMmDd]
```

The account scope is important because day-log reads are authenticated and a persisted browser cache can outlive a logout. Alternatively, clearing the entire persisted query client on logout/account switch is required. In practice, doing both—account-scoped persistent storage plus clear-on-logout—is the safer posture for a device that can be shared.

`null` must be treated as real cached knowledge: it means "the server confirmed no log for this date", not merely "not loaded". A range cache must preserve enough state to distinguish an unrequested date from a fetched empty date.

### Persistence policy decisions still needed

- **Retention and freshness are separate.** `maxAge`/`gcTime` control how long a persisted entry is retained; TanStack's `staleTime` controls whether restored data refetches. A useful likely policy is a short freshness window for today and a longer one for completed historical days, followed by background validation.
- **Privacy is a product decision.** Food/weight history remains in IndexedDB after a browser session. Decide whether persistence is available only with an explicit “remember this device” choice, and clear the account's cache on logout. Do not rely on HTTP `no-store` while intentionally retaining the same data in application-managed storage: the directive tells compliant HTTP caches not to store the response. [RFC 9111 §5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5)
- If HTTP caching is enabled for authenticated day-log responses, `Cache-Control: private` prevents shared caches from storing a single-user response while allowing a private cache to store it subject to the normal rules. That HTTP cache is separate from the application-managed TanStack/IndexedDB cache. [RFC 9111 §5.2.2.7](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.7)

## 2. What standard conditional GET can do for a day-log range

An ETag is an opaque validator for the **selected representation**. For this API, the selected representation can be the JSON produced by the exact range request for its authenticated user—its start/end dates, all returned slots, and the response format. [RFC 9110 §8.8.3](https://datatracker.ietf.org/doc/html/rfc9110#section-8.8.3)

Therefore this exchange is standards-aligned:

```http
GET /api/v1/daylogs?startDate=2026-08-16&endDate=2026-08-22
If-None-Match: "range-validator-from-prior-response"
```

- If the current representation has that ETag, respond `304 Not Modified` with the appropriate validator metadata and no JSON body. The client composes the already persisted per-day slots.
- Otherwise return `200 OK`, the full current seven-day response, and a replacement ETag. The client normalizes the returned slots into the seven per-day cache entries.

`If-None-Match` is specifically intended to avoid transferring an unchanged representation. For a tag list, the condition fails if **one** supplied tag matches the selected representation's ETag; a false condition on `GET`/`HEAD` yields `304`. [RFC 9110 §13.1.2](https://datatracker.ietf.org/doc/html/rfc9110#section-13.1.2)

This means an ETag on the range response answers one useful question efficiently: **is this whole requested range still the same?** It does not make the range cache redundant—the day entries are the client’s reusable data model, while the range ETag is compact revalidation metadata.

`Last-Modified` / `If-Modified-Since` could provide a weaker time-based alternative, but RFC 9110 identifies ETags as the more accurate condition when both are present. A day-log range can have several modifications in a short interval, so an opaque range ETag is the sounder default. [RFC 9110 §13.1.3](https://datatracker.ietf.org/doc/html/rfc9110#section-13.1.3)

## 3. Why a list of seven ETags is not a per-day conditional GET

Although `If-None-Match` accepts a comma-separated list, that list is not a date-to-version map. The RFC describes it as a list compared to the selected representation's one entity tag, with a match if **any** listed value matches. HTTP caches likewise validate stored responses that have the same request URI/cache key. [RFC 9110 §13.1.2](https://datatracker.ietf.org/doc/html/rfc9110#section-13.1.2), [RFC 9111 §4.3.1](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.1)

Consequences:

| Proposal | Protocol meaning | Result |
| --- | --- | --- |
| One range ETag on one range request | Validate the whole range representation. | `304` only when all visible range data is unchanged; otherwise return the range representation. |
| Seven `GET /daylogs/:date` requests, each with its own ETag | Validate seven independent resources. | Standard and precise, but seven client requests and seven server validation paths. |
| One range request with seven individual revisions | Not standard `If-None-Match` semantics. | Requires an explicit application-level sync/manifest contract. |

This is why sending seven individual conditional GETs should not be the default for the dashboard. It exchanges a small range payload for seven request lifecycles and does not remove the need for the server to find each resource's current validator. It can be appropriate only when the user is viewing independently navigated individual days or when measurement shows the payload is extremely expensive and request overhead is negligible.

## 4. A validator manifest is possible, but it is a sync API

If partial deltas become necessary, define a separate, explicit contract rather than overloading HTTP validators. For example, a client could submit the requested range and its known per-date revisions; the service responds with changed day slots (including an explicit change from a day log to `null`) and enough metadata to prove the range reconciliation completed. A `POST /daylogs:sync` is often a cleaner shape than putting a multi-month revision map in a GET URL, but the method and contract are design choices.

Illustrative payload shape only:

```ts
type DayLogSyncRequest = {
  startDate: string;
  endDate: string;
  known: Record<string, string | null>;
};

type DayLogSyncResponse = {
  changed: Array<{ date: string; revision: string | null; dayLog: DayLogResponse | null }>;
  // A range-level token or generation proving the response covers this request.
  rangeRevision: string;
};
```

Important semantic requirements before choosing this route:

1. Every state transition relevant to a slot, including created, updated, and deleted/empty, needs a version the server can compare. A `null` day without durable metadata complicates detection of a future create or deletion.
2. The server must define a coherent snapshot boundary so the delta list is correct even while writes occur.
3. Revisions are server-owned opaque values. They need not be exposed as database timestamps or row IDs.
4. Analytics should not automatically reuse full day-log payload sync. A month/three-month chart likely needs a compact summary/aggregation resource with its own validator and refresh policy.

## 5. Does validation still hit the database?

Yes—unless a cache or maintained metadata answers it first. A `304` saves the response body transfer, JSON work, and potentially the expensive retrieval of all food entries, but the origin still has to establish whether its current representation matches the supplied validator. HTTP deliberately leaves the validator's generation strategy to the service author. [RFC 9110 §8.8.3.1](https://datatracker.ietf.org/doc/html/rfc9110#section-8.8.3.1)

The performance question is therefore a data-access design question:

- A range ETag recomputed by loading all seven full aggregates can still save bandwidth but may save little database work.
- A range validator calculated from a narrow, indexed day-log revision/updated-at projection can avoid loading child entries and be substantially cheaper. It still normally examines metadata for the requested range.
- A maintained per-user change generation or change log can make "anything in this range changed since token T" cheap, but it adds correctness and write-path complexity. A global per-user generation alone creates false positives for changes outside the range unless the design also filters changes by date or accepts that trade-off.
- An in-memory/distributed server cache can eliminate even that metadata query on a hit, but invalidation, multi-instance behavior, and recovery become new system responsibilities.

These are implementation inferences from the RFC’s rule that the service chooses the validator mechanism; they are not a claim that conditional GET automatically bypasses persistence.

## Recommended direction to take into planning

1. **Normalize first.** Keep one durable per-day client entry (including known-empty slots), account-scope it, and persist only after deciding the shared-device/logout policy.
2. **Keep the first server change narrow.** Retain the batch range endpoint and add a **range-level ETag/If-None-Match** path. It preserves one request for dashboard/goals, returns `304` when the overlap is unchanged, and needs no client-sent per-day manifest.
3. **Write mutation results/invalidation precisely.** A change to date D should update/invalidate date D and any active composed view that includes D; avoid globally invalidating every historical day. TanStack supports exact and partial-key invalidation, but the query-key hierarchy needs to be decided first. [TanStack: QueryClient invalidation](https://tanstack.com/query/latest/docs/reference/QueryClient)
4. **Instrument before adding a manifest.** Measure range endpoint database time, payload size, `304` hit rate, IndexedDB restore latency, and stale-data corrections. Only introduce a delta/manifest endpoint if long-range analytics or observed payload/query costs justify its extra consistency machinery.

## Decisions for the grilling session

1. Is offline access to previously loaded food/weight data an explicit product promise, or is this strictly a warm cache for an online experience?
2. On logout/account change, must all persisted data be removed immediately? Is persistent storage allowed on a shared device?
3. What is the allowed staleness for today, yesterday, older completed days, and goal/dashboard analytics?
4. Can a user edit historic days, and can a day log be deleted/reset? These determine validator and invalidation semantics for `null` slots.
5. What is the actual bottleneck today: endpoint/database time, response size, repeat network latency, or render cost? Capture a baseline before selecting server-side validator metadata or a manifest protocol.
