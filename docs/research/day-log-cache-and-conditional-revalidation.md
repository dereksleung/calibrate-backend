# Day Log cache and bounded synchronization research

_Initially researched 2026-08-22; revised 2026-09-02 after the design grilling session._

External sources in this note are primary documentation: TanStack Query, MDN, and the HTTP RFCs.

## Conclusion

The chosen design—account-scoped, date-keyed TanStack Query persistence plus bounded `POST /daylogs:sync`—is technically sound and better fits Calibrate's requirements than an ETag-only range protocol.

The endpoint is intentionally an application synchronization protocol, not conditional HTTP. A sparse per-date version manifest lets the server use a narrow `(date, version_number)` projection, return `204` with no body when all supplied knowledge matches, and otherwise return only changed or unloaded date slots. It removes the prior special-case next-day overlap protocol while retaining the important performance property: unchanged Day Log aggregates and Food Entries are neither transferred nor rehydrated.

The persistent cache needs a durable, monotonic cache-lifecycle fence in IndexedDB. BroadcastChannel is appropriate to make active tabs react quickly, but is not a durable correctness mechanism. The fence must survive snapshot deletion and must be checked transactionally by restore and persist operations so a stale tab cannot revive a cache after logout.

## Current codebase baseline

- `GET /api/v1/daylogs?startDate&endDate` currently returns one slot per requested date, including `dayLog: null`. Its client range key is currently `['dayLogs', 'range', startDate, endDate]`; an individual-day key is separately `['dayLogs', date]`. Neither includes account identity.
- `apps/web-frontend/src/main.tsx` provides the root `QueryClientProvider`. `SessionRestorationGate`, Header, and auth-facing UI use React Query, so a persistence provider cannot simply replace that root with a conditionally mounted provider without disrupting those consumers.
- The workspace already declares `@tanstack/react-query-persist-client` and `@tanstack/query-async-storage-persister` 5.100.5 in the web frontend lockfile. No new package is required for a native IndexedDB `Persister`.
- `getRollingSevenDayDateRange` means today minus six days through today. Dashboard V2 requests it once. Logs is currently a single-day editor, while the planned week scroller is a Sunday-to-Saturday presentation concern.
- `useSaveFoodEntry` currently returns a Food Entry and invalidates the selected-day query plus all range keys. It needs a precise, version-aware write-delta path rather than a global range invalidation.
- `buildNutrientAnalyticsModel` has 14-plus-14 comparison logic but receives the live seven-day query today. Passing it 28 days without changing Total would incorrectly make the displayed total span 28 days; the plan must retain a seven-day Total while using all 28 for Change.

## 1. TanStack persistence supports the required provider and custom persister

TanStack documents a `Persister` with `persistClient`, `restoreClient`, and `removeClient`, including an IndexedDB example. Its React `PersistQueryClientProvider` handles subscription lifecycle and prevents mounted queries from fetching while asynchronous restoration is ongoing; queries can render in an idle fetching state until restoration is complete. This supports mounting persistence only below a server-authenticated session gate rather than at the global app root. [TanStack persistence provider and custom persister](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)

The persisted value is the dehydrated QueryClient, not a separate IndexedDB record per TanStack key. That remains compatible with one date-keyed query per Day Log: normalize range/sync slots into entries such as `['dayLogs', accountId, yyyyMmDd]`, then use dehydration filtering to persist only that allow list. Query keys must contain account identity because the browser storage is otherwise shared between accounts.

TanStack also documents the retention caveat: `gcTime` should be at least the persisted maximum age, but JavaScript timer limits make a direct 30-day value unsafe. `Infinity` disables Query's timer-based garbage collection. The accepted design uses that with explicit date-slot pruning before hydrate/persist, which makes the 30-day retention rule deterministic rather than timer-dependent. [TanStack persistence and `gcTime`](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)

`createAsyncStoragePersister` demonstrates the storage abstraction but does not solve the needed multi-store transaction or cache-generation protocol by itself. A custom native IndexedDB persister is appropriate because the `Persister` interface is explicitly intended for custom storage implementations. [TanStack async-storage persister](https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister)

## 2. Why `POST /daylogs:sync` replaces ETags and `304`

An ETag validates one selected HTTP representation. A range ETag can efficiently answer “is this exact complete range unchanged?” and a matching `If-None-Match` on a GET can return `304`. It cannot express “date A is revision 2, date B is known absent, and date C is unloaded; return only the mismatches.” `If-None-Match` compares tags to the selected representation rather than providing a date-to-version map. [RFC 9110: entity tags](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3), [RFC 9110: If-None-Match](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.2)

The selected manifest format is therefore deliberately application-specific:

```ts
type DayLogSyncRequest = {
  startDate: string;
  endDate: string;
  known: Record<string, number | null>;
};

type ChangedDayLogSlot = {
  date: string;
  versionNumber: number | null;
  dayLog: DayLogResponse | null;
};
```

Omission is distinct from `null`: omission means Unloaded and requires a response slot; `null` says Known-empty and is a match only when the server also has no Day Log. A positive version matches only the same server-owned Day Log revision. On `200`, omitted unchanged slots are still validated by the response's range-complete semantics; this is why the client may timestamp every requested date after either successful status.

The protocol requires the database operation to read the version projection and any returned full aggregates from one coherent snapshot. A narrow projection saves Food Entry loading only when all or many requested slots match; it does not mean a `204` has zero database work. That is the desired trade: lower aggregate/database work and no response body for common unchanged ranges, without misleadingly claiming a cache hit bypasses all storage.

Plain positive `int32` versions are sufficient. They are not authorization tokens, are never trusted as write preconditions, and disclose only a change count for data the caller is already allowed to read. Opaque tokens would increase protocol and storage complexity without giving a privacy or integrity benefit here.

`Cache-Control: private, no-store` is coherent with intentionally persisting an application-managed, authenticated cache: it keeps HTTP caches out of the design while the explicit IndexedDB policy controls what is retained. RFC 9111 distinguishes `private` from `no-store`; the latter tells HTTP caches not to store the response. [RFC 9111: `no-store`](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.5), [RFC 9111: `private`](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.7)

## 3. Cross-tab logout: durable fence versus notification

BroadcastChannel lets same-origin browsing contexts exchange messages, which makes it a good fast path for an active tab. It does not persist a message for a tab that is not actively receiving, and it cannot serialize an in-flight IndexedDB snapshot write with a logout in another tab. [MDN: Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)

A deleted cache key is also insufficient evidence: deleting a snapshot removes the very fact a dormant tab needs in order to know a revocation occurred. The selected design instead uses a separate persistent lifecycle record with a monotonically increasing generation:

1. A session-confirmed persister captures `(accountId, generation)` as a lease.
2. Restore reads its snapshot and lifecycle record in one transaction, and returns a snapshot only when the stored generation equals that lease.
3. Persist reads the lifecycle record and conditionally writes the snapshot in the same overlapping read-write transaction.
4. Successful logout/confirmed session loss increments generation and deletes the account snapshot in one transaction.

IndexedDB supports object stores and transactions; keeping the fence and snapshot stores in the same database lets the implementation establish this atomic ordering boundary. The exact helper API should encapsulate the transaction so UI code cannot bypass the check. [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

On every tab, BroadcastChannel is supplemented with fence checks on mount, `pageshow`, visibility-to-visible, focus, and a 15-second interval while visible. Page visibility is a useful lifecycle signal, but periodic timers are throttled in background tabs, so it is a recovery opportunity—not a guaranteed delivery service. [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

This gives a defensible ordering guarantee: a restore or persist operation that serializes after the lifecycle transaction commits cannot use an old lease. It does not retroactively erase a snapshot that another tab had restored into memory before revocation, or promise that already-painted pixels vanish in literally zero frames; browser scheduling is outside application control. The app must make the active path prompt and ensure a resumed tab purges before it uses private data again.

## 4. Freshness is driven by explicit user intent, not “unseen” ranges

“Unseen” was rejected because it could imply sooner-than-one-hour revalidation for prior calendar weeks, generating low-value traffic. The adopted policy is per-date and one-hour based:

| Situation                                   | Request behavior                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Dashboard or current Logs view              | Use rolling `today - 6` through today; cache-first, then sync if eligible.                    |
| Future date in current Sunday-Saturday week | Render Upcoming; do not model as Known-empty or sync it.                                      |
| Scroll historical Calendar weeks            | No request.                                                                                   |
| Explicitly select historical date `D`       | Cache-first; only if D is unloaded, unverified, or one-hour stale, sync `D - 6` through D.    |
| Select a nearby historic date after success | Skip while its own validation timestamp remains fresh.                                        |
| Open Nutrient Analytics drawer              | Cache-first; when coverage is stale/incomplete, deliberately sync `today - 27` through today. |

This matches human calendar navigation without asking for future-day absences, bounds automatic work, and makes the 28-day data transfer a user-initiated analytics operation rather than background prefetch.

## 5. Mutation reconciliation needs an explicit predecessor

Immediate post-write sync would add server work precisely during expected meal-time bursts. A compact mutation delta is safe only with a predecessor version: `previousVersionNumber`, `versionNumber`, Day Log ID, and created Food Entry. The client may patch a complete cached aggregate only when its stored version equals the predecessor. Otherwise it must show the acknowledged local result while marking the date slot unverified for a later normal sync.

This avoids two harmful alternatives: a follow-up read immediately after every write, and silently advancing a stale partial aggregate over a cross-device update. It also makes precise invalidation possible: do not invalidate every historical range for one Day Log mutation.

## Research outcome for implementation

1. Preserve the custom `Persister` seam and mount `PersistQueryClientProvider` only after server session confirmation, inside—not instead of—the root query provider.
2. Implement `POST /daylogs:sync` as a bounded, documented application protocol with `204`/sparse `200` semantics; remove ETag and six-day overlap work from the plan.
3. Put the privacy guarantee in a fenced IndexedDB transaction. Use BroadcastChannel and visible-tab checks for responsiveness and recovery.
4. Treat `lastValidatedAt` as per-date metadata. Every successful sync validates all requested dates even when `200` only contains some payloads.
5. Use the existing Day Log aggregate-root write path to version response-visible writes atomically. Do not introduce child write repositories or an analytics projection endpoint for this scope.
