# ADR-0004: Bounded Day Log synchronization and cache-lifecycle fencing

**Status:** Accepted

## Context

Calibrate needs fast cache-first Day Log reads without repeatedly transferring and rehydrating unchanged Food Entries. The previous ETag design optimized exact range reads, but needed a special six-day rollover validator and did not let the server return only the individual dates that changed. It also did not fully resolve a shared IndexedDB race: a tab that missed a logout broadcast, or that was persisting while another tab logged out, could otherwise restore or revive a prior account's private cache.

The existing Day Log read model is naturally date-keyed. A response-visible Day Log write can have a server-owned revision, while the absence of a Day Log is also meaningful cached state. Those facts support a client manifest instead of HTTP cache validators.

## Decision

### Synchronization protocol

Add authenticated `POST /daylogs:sync`. A request names one contiguous inclusive calendar-date range of at most 31 dates and sends a sparse manifest of what the client knows for those dates:

- no manifest entry means the date is unloaded;
- `null` means the client knows the date has no Day Log; and
- a positive `int32` `versionNumber` means the client has that Day Log revision.

The API validates the requested range and manifest shape. It first reads a narrow, user-scoped `(date, version_number)` projection in a coherent Postgres snapshot. If every requested date matches the server's current state, it returns `204 No Content`. Otherwise it returns `200 OK` with only the requested dates that were unloaded or changed, as `{ date, versionNumber, dayLog }` slots. `dayLog: null` represents confirmed absence. A successful `200` or `204` validates every requested slot, including slots omitted from a `200` response.

`versionNumber` is a plain, server-owned positive `int32`, not an opaque validator. It conveys no authority and only exposes a change counter for data the caller is already authorized to read. The server never trusts it as a write precondition. Each response-visible Day Log aggregate write advances it atomically in the aggregate-root repository transaction. A newly created Day Log starts at version 1; a persisted empty aggregate also has a version. Deletion and recreate semantics are deliberately out of scope.

The application defines a user-scoped Day Log sync read use case and ports in domain/application terms. The presentation layer owns HTTP validation, `204`/`200` mapping, and API contracts. The Postgres adapter owns the consistent projection and aggregate-load transaction. HTTP response caching is not part of this protocol: sync responses use `Cache-Control: private, no-store` and have no ETags.

### Persisted cache and privacy boundary

The canonical client cache is one identity-scoped date slot per Day Log date, including `Known-empty`, its `versionNumber` when present, `lastValidatedAt`, and an `unverified` state for a locally acknowledged write that could not be safely merged. Query keys include the server-confirmed account ID. The root `QueryClientProvider` remains mounted because session and surrounding UI use React Query; a `PersistQueryClientProvider` for the same client mounts only below the server-authenticated session gate and is keyed by account ID plus cache lifecycle generation. Only the allow-listed Day Log slots and validation metadata dehydrate. Authentication queries, tokens, mutations, and unrelated data never persist.

A native asynchronous IndexedDB persister keeps cache snapshots in a `persistedClients` object store and a durable `{ accountId, generation }` cache-lifecycle fence in a separate `cacheLifecycle` store in the same database. A persister captures its account/generation lease only after session confirmation. Restore reads its snapshot and fence in one transaction and accepts it only when that lease matches. Persist reads the fence and conditionally writes the snapshot in one overlapping read-write transaction; a stale tab cannot re-create a snapshot after another tab has revoked its generation. `removeClient` removes only the scoped snapshot, not the lifecycle record.

After successful server logout, or a conclusively confirmed session loss, a tab increments the account generation and deletes that account's snapshot in one IndexedDB transaction, then stops persistence, cancels and removes private in-memory queries, and navigates to login. It broadcasts the generation as an immediate accelerator. Every tab also reads the fence on mount, `pageshow`, visibility return, focus, and every 15 seconds while visible. The periodic check is a fallback, not a timing guarantee: browser background timers can be throttled. A failed logout or transient session-refresh failure does not revoke the cache.

The resulting boundary is deliberately realistic: a restore or persist operation that serializes after a fence commit cannot use the stale lease. A restore that serialized before revocation can already have reached in-memory UI, so an active tab is promptly purged and a dormant tab clears before reuse. Browser scheduling cannot guarantee that already-painted pixels disappear in literally zero frames.

Persisted slots are retained for 30 days after their last successful validation. The app explicitly prunes them before hydration and persistence. It does not rely on a 30-day JavaScript `gcTime` timer, because native timer limits are shorter; in-memory query garbage collection remains effectively infinite while the app's explicit pruning policy governs retained Day Log slots. IndexedDB denial or corruption degrades to a non-persisting empty online cache, and storage errors do not break rendering or query subscriptions.

### Freshness and view behavior

One hour is the normal validation freshness period. Cache-first composition always renders known slots before a qualifying background sync. Dashboard synchronizes its rolling seven-day range (`today - 6` through `today`). Logs displays a human Sunday-to-Saturday Calendar week, but the current week uses the same rolling seven-day range and can reuse Dashboard slots. Future dates are Upcoming, disabled, and never represented as Known-empty.

Scrolling a historical Calendar week does not request data. Explicitly selecting a historical date synchronizes the selected date and the preceding six days only if that selected slot is unloaded, unverified, or at least one hour since its last successful validation. Freshness is evaluated for the selected date, not the calendar-week range. A successful sync timestamps all seven dates, reducing nearby browse requests. Nutrient Analytics waits until its drawer opens, then synchronizes the preceding 28 dates when its coverage is not fresh; it renders cached slots first and does not claim a complete comparison until all 28 dates are confirmed.

Food Entry mutations return a compact write delta: the created entry, Day Log ID, previous version (or `null` for an aggregate created from known absence), and new version. The client patches a cached slot only when its predecessor version matches. On a mismatch or unloaded slot it keeps a locally acknowledged view but marks the slot unverified for normal sync rather than issuing an immediate follow-up request during meal-time traffic.

## Consequences

This removes the ETag/`304` and rollover-overlap mechanisms. It provides the same zero-body unchanged response plus sparse changed-date responses, at the cost of a `POST` body and a bounded manifest protocol. The endpoint's 31-date cap prevents accidental large aggregate transfer while allowing the deliberate 28-day analytics action.

The cache fence adds IndexedDB transaction and lifecycle complexity, but prevents a stale tab from winning a logout race through a later write. BroadcastChannel alone is insufficient because delivery is not durable and a tab can be suspended. The design accepts bounded revocation detection for dormant tabs while making persistent restoration and persistence race-safe.

The frontend needs an explicit cache composer and per-date validation metadata rather than treating a range response as durable data. The backend needs a version column, migration/backfill rule, atomic aggregate writes, a projection read port, and a coherent snapshot. These changes remain within the existing clean-architecture direction: presentation depends on application contracts, infrastructure owns SQL and transactions, and Day Log child writes remain aggregate-root writes.

## Considered options

- **ETags plus `304` and a special rollover overlap:** familiar HTTP semantics, but exact-range validators cannot return per-date changes and require a second rollover protocol.
- **Opaque revisions:** hide the count but add server/client complexity without improving authorization or integrity; version numbers are already untrusted request hints.
- **BroadcastChannel-only logout cleanup:** fast when delivered, but not durable and cannot serialize against an in-flight IndexedDB write.
- **A deleted tombstone key:** a later deletion loses evidence needed by dormant tabs. A monotonically increasing fence survives snapshot deletion and establishes a lease boundary.
