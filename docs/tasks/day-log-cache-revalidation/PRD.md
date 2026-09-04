# Private Day Log Cache and Bounded Synchronization

Status for Matt Pocock skills: ready-for-agent

## Problem statement

On a new day, the previous week's day logs are highly likely to still be the same, and the further in the past, the likelier this will be, as it becomes a hassle to either remember exactly what and how much was eaten, or to catch up entering everything. Calibrate's Day Log views should paint immediately from existing available data, and synchronize and reconcile cheaply when accuracy matters, and reduce request volume and data transfer. Repeated visits around meals currently risk fetching and rebuilding food-entry payloads that the client already knows. Calibrate's anticipated usage is daily, with concurrent request spikes around mealtimes as users record food and revisit their stats. Those peaks should not transfer or rehydrate the full seven-day or 28-day food-entries payload on every visit, so repeat checks stay within free-tier egress.

Persistence has a separate privacy challenge. Browser tabs share IndexedDB. A user can log out in one tab while another tab is suspended or still writing its cache; a BroadcastChannel message is useful but is neither durable nor a sufficient serialization boundary. The design must ensure a prior account's wellness data cannot later be restored or persisted again after successful logout, account transition, or confirmed session loss.

## Outcome

Persist an authenticated, account-scoped Day Log client-side cache that restores only after server session confirmation, renders screens using cached date slots, and uses `POST /daylogs:sync` to validate a bounded date range. An unchanged request has a zero-byte body (`204`); a changed request transfers only changed or unloaded dates (`200`). The same protocol supports Dashboard's rolling seven days, deliberate historical-day browsing, and the Nutrient Analytics drawer's deliberate 28-day refresh without inventing separate rollover or analytics APIs.

For a fallback when IndexedDB is unavailable or corrupt, the user receives an empty online cache; offline editing, queueing, and conflict resolution remain out of scope.

A client-side cache is the design that makes sense from expected usage patterns. You cannot easily predict what records will be read the most on the server, making a server-side cache impractical, for the following reasons:

- Every client reads their own food log data, so each day log and food entry will be read roughly the same amount, less often if the user has less time that day to log food.
- They will browse historical records sometimes, to varying levels of depth.
- Every client will read different portions of the food catalog depending on their search terms and their changing tastes for what they choose to eat that day.

## User stories

1. As a signed-in user, I see the Dashboard's last synchronized rolling seven days immediately, then a background refresh only when its data is due for validation.
2. As a user returning repeatedly around a meal, I do not download or rehydrate unchanged Day Logs and Food Entries merely to confirm that they are unchanged.
3. As a user with no Day Log for a date, I have a cached `Known-empty` state distinct from an unloaded date and from an existing Empty Day Log.
4. As a user on a shared browser, I never have another account's persisted wellness data restored during session bootstrap.
5. As a user logging out in one tab, I want every other tab to purge prior private state promptly and to be unable to restore or re-persist it after revocation, even if it missed the live notification.
6. As a user whose logout failed, I want the application to retain my private cache and session state rather than treating that logout as successful.
7. As a user opening Logs, I see a familiar Sunday-to-Saturday Calendar week while current data reuses the rolling seven-day data that Dashboard already synchronized.
8. As a user viewing an upcoming day in the current Calendar week, I see it as Upcoming rather than as an empty historical log.
9. As a user scrolling older Calendar weeks, I do not cause background network requests merely by browsing the calendar.
10. As a user explicitly selecting an old day, I get cached data first and a background reconciliation of that day plus its six predecessors when the selected day needs validation.
11. As a user opening Nutrient Analytics, I see available cached nutrition first while the intentional 28-day window reconciles, and I do not see a partial comparison presented as complete.
12. As a user adding Food Entry data, I see an acknowledged local update without the client immediately adding another sync request during peak meal-time traffic.
13. As a user whose Day Log changed elsewhere, I eventually see the server truth when my stale or unverified date becomes eligible for ordinary synchronization.
14. As a maintainer, I can measure cache usefulness and sync efficiency without recording Food Entry, Day Log, or authentication content.

## Product and protocol decisions

### Date-slot cache model

- The canonical durable client shape is one account-scoped date slot per calendar date. A slot records Day Log data or `Known-empty`, a present Day Log `versionNumber`, `lastValidatedAt`, and whether a locally patched write is `unverified`.
- A missing slot is Unloaded. `Known-empty` is a confirmed absence. An Empty Day Log is a present aggregate, potentially with a weight observation, and is not an absence.
- Query keys include account ID. The existing root `QueryClientProvider` remains because session-gate, Header, and auth UI use React Query. A `PersistQueryClientProvider` using the same client mounts only below server-authenticated content and is remounted for an account or cache-generation change.
- Dehydration is an explicit allow list: Day Log slots and their validation metadata only. Never persist auth/session queries, access or refresh tokens, mutations, or unrelated queries.
- Retain a slot for 30 days after last successful validation. Explicitly prune stale-retention records before hydration and persistence; do not rely on a 30-day JavaScript garbage-collection timer. IndexedDB errors are caught and result in a no-op persister plus online behavior.

### `POST /daylogs:sync`

- The endpoint accepts a contiguous inclusive `startDate` and `endDate`, capped at 31 local calendar dates, plus sparse per-date known-version entries.
- An omitted entry says Unloaded; `null` says Known-empty; a positive `int32` says the cache has that Day Log revision. The version is a plain server-owned counter, never a capability or write precondition.
- The backend makes a narrow user-scoped `(date, version_number)` projection in a coherent database snapshot before loading aggregates. It returns:
  - `204 No Content` when every requested slot matches the manifest. The response has no body.
  - `200 OK` with only changed or unloaded `{ date, versionNumber, dayLog }` slots otherwise. `dayLog: null` confirms Known-empty.
- A successful `200` or `204` confirms all requested dates. The client stamps `lastValidatedAt` for every requested date, not only returned slots.
- Responses use `Cache-Control: private, no-store`; they have no ETags, `If-None-Match`, `304`, `Vary: Cookie`, or rollover-overlap validator.
- `day_logs.version_number` is a positive `int32`. Migration/backfill initializes existing rows. The aggregate-root repository atomically advances it with every response-visible Day Log write; a newly created log becomes version 1. Day Log deletion is not in this scope.

### Cross-tab cache revocation

- The native asynchronous IndexedDB persister has separate `persistedClients` and `cacheLifecycle` object stores. A durable lifecycle record contains an account-scoped monotonically increasing generation.
- After server session confirmation, a persister captures an `{ accountId, generation }` lease. Restore reads fence and snapshot in one transaction and returns data only if they match; persist checks the fence and writes the snapshot in one overlapping read-write transaction, so a stale tab cannot revive data after logout.
- After successful server logout, or only after session loss is conclusively confirmed, one IndexedDB transaction increments the generation and deletes the account snapshot. The tab stops persistence, cancels/removes private in-memory queries, and navigates to login. Failed logout or transient refresh failure does none of these.
- BroadcastChannel broadcasts the new generation for prompt active-tab cleanup. It is an accelerator, not a correctness condition. Each tab also checks the fence on mount, `pageshow`, visibility return, focus, and every 15 seconds while visible.
- The guarantee is persistence-safe rather than magically instantaneous pixel erasure: a restore or persist serialized after revocation cannot use the stale lease. A tab that had already restored can retain in-memory pixels until prompt active cleanup or its next lifecycle check; suspended tabs purge before reuse.

### View-specific synchronization

- **Dashboard:** compose `today - 6` through today from date slots. It starts a background sync only when the view needs validation, and can reuse in-flight work through query deduplication.
- **Logs:** display a Sunday-to-Saturday Calendar week. The current Calendar week reuses Dashboard's rolling seven-day range; dates after today are Upcoming and disabled. Users cannot navigate to future Calendar weeks. Merely scrolling a historical week is network-silent. When the user explicitly selects historical date `D`, compose the cache first and, only when slot `D` is Unloaded, unverified, or at least one hour since its last successful validation, sync `D - 6` through `D`. Check freshness of the selected date, not the whole week; all seven dates receive validation timestamps on success.
- **Nutrient Analytics drawer:** opening the drawer is the deliberate 28-day action. Compose cached slots immediately and sync `today - 27` through today only when its coverage is stale, incomplete, or unverified. Display `Updating — N/28 days available` while incomplete. The existing Total remains the most recent seven days; Change compares the most recent 14 days with the preceding 14 and remains pending until all 28 dates are confirmed.

### Food Entry write behavior

- Successful Food Entry creation returns the created entry, parent `dayLogId`, `previousVersionNumber` (`null` only for known absence becoming a new Day Log), and `versionNumber`.
- The client patches a Day Log slot only if its cached predecessor version exactly equals `previousVersionNumber`. It updates the entry and version without issuing `sync`.
- If the slot is absent or version-mismatched, keep a locally acknowledged UI result but mark the slot unverified. A later ordinary eligible sync retrieves truth; do not promote a partial stale cache to the new revision or globally invalidate every Day Log range.

## Implementation boundaries

- This crosses web UI/query composition, shared API client, `@calibrate/api-contracts` as the presentation boundary, backend presentation, application read ports/use cases, persistence infrastructure, and the Day Log aggregate-root repository.
- Preserve dependency direction: presentation maps HTTP and contracts; application uses Day Log terms; infrastructure owns SQL, read snapshots, migration, and transactions; child writes stay through the Day Log aggregate root. No database rows leak through application ports.
- The current persistence packages are already present. Do not install a new dependency for the custom IndexedDB persister.
- No separate analytics endpoint or general server delta feed is needed. The bounded Day Log sync delivers the existing aggregate detail that the analytics model requires.

## Testing and evidence

- **Sync protocol:** 31-date bound, malformed manifest rejection, authenticated account isolation, narrow unchanged `204` with no body, sparse `200` changed/unloaded slots, `no-store` headers, coherent projection/snapshot, and aggregate-write version advancement.
- **Persistence and privacy:** actual IndexedDB browser coverage for server-gate-first restoration, account scoping, unavailable/corrupt storage fallback, successful versus failed logout, missed BroadcastChannel delivery, resume/focus fallback, and persist/restore races against a revocation fence.
- **Client behavior:** Known-empty versus Empty versus Unloaded; every successful sync's per-date timestamp; dashboard reuse; Sunday calendar/DST/year boundaries; Upcoming future cells; historical scroll silence; historic selection `D-6..D`; neighbor selection fresh skip; cache-first offline/error states; local write patch and mismatch-to-unverified behavior.
- **Analytics:** no 28-day request before drawer opening; cache-first partial coverage; 28-date stale sync; Total from seven dates; Change from 14-plus-14 only after complete confirmation; no partial data silently represented as known empty.
- **Measurement:** privacy-safe cache-restore and usable-view timings, projection versus aggregate work, request/response bytes, `204` ratio, and sync reason. Never emit food, Day Log, user-session, or token content. Use deterministic behavioral assertions rather than timing thresholds in CI.

## Out of scope

- Offline Day Log/Food Entry creation, editing, deletion, queues, retries, conflicts, or merge semantics.
- Day Log deletion/recreation and durable deletion-version semantics.
- ETags, `If-None-Match`, `304`, browser/CDN/API response caching, the old six-day rollover-overlap protocol, or a general unbounded delta-sync API.
- Sync ranges above 31 dates, month/quarter reporting endpoints, or server-side analytics projections.
- Changes to cookies, refresh-token rotation, session lifetime, or authentication authorization rules.
- A claim that browser tabs can remove already-painted private pixels at a literal zero-frame latency after another tab logs out.

## Rollout and success criteria

1. Land the private cache and lifecycle fence before exposing persisted Day Log data.
2. Land the backend sync protocol and aggregate version lifecycle, then wire cache composition and client writes.
3. Introduce Logs historic selection and Nutrient Analytics only after per-date validation behavior is covered.
4. Review the privacy-safe measurements after production-like usage. Success means repeat visits generally paint cache-first; unchanged syncs commonly return `204`; projection validation is materially cheaper than aggregate loading; and no account-crossing restore/persist behavior is observed.
