# 02: Harden Day Log cache logout recovery

**What to build:** Harden ticket 01's successful logout path against failures while it calls the server, commits the IndexedDB generation fence, and deletes a private snapshot. A confirmed server logout must never permit the old private cache to restore or persist again, even when a write fails, a response is ambiguous, or cleanup must resume later.

**Blocked by:** 01: Restore a private Day Log cache with a lifecycle fence.

**Status:** ready-for-agent

## Architecture precondition

This ticket intentionally replaces ticket 01's simple post-server one-transaction revocation with a durable multi-phase recovery protocol. Before implementing it, update [ADR-0004](../../../adr/0004-bounded-day-log-sync-and-cache-fence.md) and [the PRD](../PRD.md) to record that change, its transaction boundaries, and its recovery trade-off. The amended ADR and PRD are the source of truth for implementation.

- [ ] Add an account-scoped durable logout record to the `cacheLifecycle` store, with an operation ID, phase, and target generation. It must prevent stale retries from resolving newer logout work and make generation advancement idempotent.
- [ ] Commit `logout-pending` before calling the server. If that write fails, do not call server logout; retain the authenticated session/cache and show a retryable storage error.
- [ ] Await a successful server logout before committing `server-logout-confirmed`. A definitive server failure clears the matching pending marker and retains the session/cache; an ambiguous result remains fail-closed and is never presented as completed logout.
- [ ] Advance the generation using bounded fresh IndexedDB transactions with read-back. Once the fence commits, stop persistence, purge private in-memory queries, and allow navigation to login even when later physical cleanup must retry.
- [ ] Independently delete the snapshot and resolve the matching lifecycle record. Keep `cleanup-pending` durable on failure, gate private cache hydration/persistence, and offer a retry that performs local cleanup only; a later successful login must not clear it or restore old data.
- [ ] Cover the deterministic failure paths below with actual IndexedDB where the browser boundary matters. Do not use `localStorage` as another correctness authority; BroadcastChannel is only an active-tab cleanup accelerator.

## Implementation contract

### Durable lifecycle record

Keep the lifecycle record in the same IndexedDB `cacheLifecycle` store as the account fence. It is account-scoped and contains at least:

~~~ts
type LogoutPhase =
  | "logout-pending"
  | "server-logout-confirmed"
  | "fence-committed"
  | "cleanup-pending"
  | "resolved";

type LogoutRecord = {
  accountId: string;
  operationId: string;
  phase: LogoutPhase;
  targetGeneration?: number;
};
~~~

The `operationId` prevents a stale retry from clearing a newer logout record. `targetGeneration` makes fence advancement idempotent: a retry treats any stored generation greater than or equal to the target as success, rather than incrementing again. A committed `resolved` phase is the terminal logical state; after all cleanup succeeds, the record may be removed.

The durable ordering is:

1. In a fresh transaction, write `logout-pending` before sending the server logout request. If this write fails, do not call the server. Keep the user on the current page, preserve the authenticated session/cache, and show a retryable storage error.
2. Await a successful server logout response. A definitive server failure clears the matching pending marker and preserves the session/cache. An ambiguous outcome remains fail-closed in `logout-pending`; it must not be presented as a completed logout.
3. After server success, durably commit `server-logout-confirmed`. From this point the app must not restore or persist the old private cache.
4. Advance the generation in a fresh read-write transaction and read it back. Retry a failed/aborted transaction with a bounded policy and a new transaction each time. The transaction sets the stored generation to at least `targetGeneration`; it must not blindly increment on every retry.
5. Once the generation is confirmed, commit `fence-committed`. The generation mismatch is the durable invalidation authority even if physical snapshot deletion later fails. Stop persistence and purge private in-memory queries.
6. Delete the account snapshot and clear the matching lifecycle record. Deleting an already-missing snapshot is success. If deletion or marker resolution fails, retain `cleanup-pending` and require local cleanup retry.

The preferred path completes fence and snapshot cleanup before navigation. If server logout is confirmed and the fence is committed but physical cleanup cannot finish, navigation to login is allowed with `cleanup-pending`; the old snapshot remains unusable because its generation is fenced. If the fence itself cannot be committed after bounded retries, remain on the current page in a fail-closed recovery state and do not expose private cache use.

### State machine

~~~mermaid
stateDiagram-v2
    direction LR

    [*] --> Active
    Active --> LogoutPending: logout-pending marker commits
    Active --> Active: marker write fails / no server call

    LogoutPending --> Active: server logout definitively fails; clear marker
    LogoutPending --> LogoutPending: outcome ambiguous; remain fail-closed
    LogoutPending --> ServerLogoutConfirmed: server succeeds + phase commits

    ServerLogoutConfirmed --> ServerLogoutConfirmed: fence transaction fails; bounded fresh retry
    ServerLogoutConfirmed --> FenceCommitted: target generation commits + read-back succeeds

    FenceCommitted --> Resolved: snapshot cleanup + matching marker clear succeed
    FenceCommitted --> CleanupPending: cleanup or marker resolution fails
    CleanupPending --> CleanupPending: local Retry cleanup fails
    CleanupPending --> Resolved: local Retry cleanup succeeds

    Resolved --> Active: new session acquires a new lease
~~~

`FenceCommitted` is the earliest state in which login navigation is allowed. `CleanupPending` and `Resolved` are not allowed to restore the old account snapshot.

### App behavior by state

| State | What the app does | What the user sees |
| --- | --- | --- |
| Active | After server session confirmation, restore only the account/generation lease and allow normal private queries and persistence. A logout click first attempts the durable marker write. | Normal authenticated UI. |
| LogoutPending | Keep the current page and session/cache while the server request is in flight. Block new private persistence/mutations where practical. On definitive failure, clear the marker and return to Active; on ambiguity, remain fail-closed and offer retry of the logout operation. | Progress/error status; never claim that logout completed. |
| ServerLogoutConfirmed | Stop treating the old cache as usable, commit the fence with bounded retries, and cancel/remove private in-memory queries. Do not navigate before the fence commits. | Signed-out recovery state while the durable fence is committed. |
| FenceCommitted | Treat every old lease and snapshot as stale. Attempt physical snapshot deletion and matching marker resolution. Never restore the old snapshot, even if deletion is temporarily unavailable. | Login is allowed; cleanup may continue before or after navigation. |
| CleanupPending | Keep the persistent marker and gate private cache hydration/persistence. Retry is local cleanup only; it must not call server logout again. A successful login alone does not clear this state or authorize old-cache use. | Login page plus a persistent banner and Toast: “You're signed out, but we couldn't finish clearing your private Day Log data. Retry clearing data before continuing.” Button: Retry. |
| Resolved | Clear the pending record, ensure the old snapshot is removed or invalidated, then allow a new authenticated lease. A later successful login starts from a fresh/online cache and never restores the old snapshot. | Normal login and account initialization. |

If the user leaves the login-page Toast untouched, the marker remains durable across reloads. The app may authenticate the user, but the private provider stays gated until Retry completes. A different account must not inherit or use the prior account's lease.

### Cleanup, retries, and idempotency

- Use a bounded retry policy for generation advancement: fresh transaction per attempt, short backoff, then a durable fail-closed result. Never retry an aborted IndexedDB transaction object.
- Store the intended target generation once and accept read-back `storedGeneration >= targetGeneration` as success. This handles a committed transaction whose response was lost and concurrent revocations that advanced the generation farther.
- Fence advancement, snapshot deletion, and marker resolution are independently retryable and idempotent. A missing snapshot is already clean; a matching `operationId` is required before clearing a marker.
- Once `fence-committed` exists, physical deletion failure is a cleanup/retention problem, not a reason to restore the old data. Keep the marker until cleanup succeeds so the user receives the retry affordance.
- Check the durable generation before accepting restored data and after provider hydration. If either check observes a mismatch, purge stale memory immediately and prevent the next persist.

### Required deterministic browser test coverage

Prioritize deterministic, observable browser behavior:

1. Corrupt/unavailable IndexedDB falls back to an empty online cache without breaking rendering.
2. `pageshow`, visibility-resume, and focus detect a generation mismatch after a missed BroadcastChannel message and purge stale in-memory state before reuse.
3. A marker-write failure proves that the server logout request is not sent.
4. Server logout failure preserves session/cache; successful logout is awaited before navigation; ambiguous logout remains fail-closed.
5. Generation advancement retries with a fresh transaction, reads back the target, and does not double-increment after a lost response.
6. A stale restore or persist cannot win after `fence-committed`, even when snapshot deletion fails.
7. `cleanup-pending` renders the persistent Toast/banner and Retry clears only local cleanup state; successful login alone cannot hydrate the old snapshot.
8. Marker resolution, snapshot deletion, account isolation, allow-list enforcement, and the final post-hydration fence check are covered with actual IndexedDB.

Do not add timer- or sleep-based race tests. Prove the durable invariant deterministically: test restore and persist when IndexedDB already contains a newer generation fence (or the fence read is stubbed to return one), and verify that the stale lease neither restores nor writes. Add an interleaving test only when the implementation can control the transaction boundary without wall-clock timing.

## Comments

- 2026-09-05: Split from ticket 01 so durable logout-state tracking, retry/idempotency, cleanup-pending recovery, and their failure coverage can be reviewed independently from the baseline cache fence.
