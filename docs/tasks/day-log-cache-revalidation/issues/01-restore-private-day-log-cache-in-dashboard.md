# 01: Restore a private Day Log cache with a lifecycle fence

**What to build:** A signed-in user returning to Dashboard restores only that confirmed account's allow-listed Day Log slots and validation metadata from IndexedDB. The cache is an optional performance feature, remains isolated across accounts and tabs, and cannot be restored or re-persisted by a stale tab after a successful logout or confirmed session loss.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Keep the root QueryClientProvider. Conditionally mount a same-client PersistQueryClientProvider below server-confirmed authenticated content, keyed by account ID and cache-lifecycle generation so it restores once for each lease.
- [ ] Replace anonymous Day Log keys with account-scoped date-slot and validation-metadata keys. Dehydrate only the explicit Day Log allow list; exclude session/auth data, tokens, mutations, and unrelated queries.
- [ ] Build a native asynchronous IndexedDB persister with separate persistedClients and cacheLifecycle stores. A lifecycle generation must survive snapshot deletion.
- [ ] Have restore read fence and snapshot in one transaction and accept only a matching accountId/generation lease. Have persist check the fence and write the snapshot in one overlapping read-write transaction; removeClient removes a scoped snapshot but never the fence.
- [ ] Run logout through the durable lifecycle below: commit logout-pending before calling the server, await confirmed server logout before navigation, commit the generation fence with bounded fresh-transaction retries, and retain the marker until snapshot cleanup and marker resolution succeed. Failed logout or transient refresh failure must preserve cache and session state.
- [ ] Broadcast a committed revocation for prompt active-tab cleanup. Independently check the durable fence on mount, pageshow, visibility return, focus, and every 15 seconds while visible. Do not claim zero-frame removal of pixels already painted in a suspended tab.
- [ ] Explicitly prune Day Log slots 30 days after their last successful validation before restore/persist. Use a no-op persister and empty online cache on IndexedDB denial/corruption; storage errors must not break queries or rendering.
- [ ] Add browser-level actual-IndexedDB coverage for session-gate-first restoration, account isolation, allow-list enforcement, failed storage, successful and failed logout, missed broadcast/resume, durable generation fallback, login gating, and persist/restore races with a revocation transaction.

## Implementation contract

This section is the implementation reference for the logout/cache-revocation boundary. The PRD and ADR remain the broader product and architecture sources of truth; this ticket fixes the ordering, failure behavior, and user-visible recovery decisions for this issue.

### Durable lifecycle record

Keep the lifecycle record in the same IndexedDB cacheLifecycle store as the account fence. It is account-scoped and contains at least:

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

The operationId prevents a stale retry from clearing a newer logout record. targetGeneration makes fence advancement idempotent: a retry treats any stored generation greater than or equal to the target as success, rather than incrementing again. A committed resolved phase is the terminal logical state; after all cleanup succeeds, the record may be removed.

The durable ordering is:

1. In a fresh transaction, write logout-pending before sending the server logout request. If this write fails, do not call the server. Keep the user on the current page, preserve the authenticated session/cache, and show a retryable storage error.
2. Await a successful server logout response. Do not navigate merely because the request was sent. A definitive server failure clears the pending marker and preserves the session/cache. An ambiguous outcome remains fail-closed in logout-pending; it must not be presented as a completed logout.
3. After server success, durably commit server-logout-confirmed. Only this phase authorizes navigation to login. The app must not restore or persist the old private cache after this point.
4. Advance the generation in a fresh read-write transaction and read it back. Retry a failed/aborted transaction with a bounded policy and a new transaction each time. The transaction sets the stored generation to at least targetGeneration; it must not blindly increment on every retry.
5. Once the generation is confirmed, commit fence-committed. The generation mismatch is the durable invalidation authority even if physical snapshot deletion later fails. Stop persistence and purge private in-memory queries.
6. Delete the account snapshot and clear the matching lifecycle record. Deleting an already-missing snapshot is success. If deletion or marker resolution fails, retain cleanup-pending and require local cleanup retry.

The preferred path attempts fence and snapshot cleanup before navigation. If server logout is confirmed and the fence is committed but physical cleanup cannot finish, navigation to login is allowed with cleanup-pending; the old snapshot remains unusable because its generation is fenced. If the fence itself cannot be committed after bounded retries, remain on the current page in a fail-closed recovery state and do not expose private cache use.

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

ServerLogoutConfirmed is the earliest state that may navigate to login. FenceCommitted is the earliest state in which the old snapshot is durably unusable. CleanupPending and Resolved are not allowed to restore the old account snapshot.

### App behavior by state

| State | What the app does | What the user sees |
| --- | --- | --- |
| Active | After server session confirmation, restore only the account/generation lease and allow normal private queries and persistence. A logout click first attempts the durable marker write. | Normal authenticated UI. |
| LogoutPending | Keep the current page and session/cache while the server request is in flight. Block new private persistence/mutations where practical. On definitive failure, clear the marker and return to Active; on ambiguity, remain fail-closed and offer retry of the logout operation. | Progress/error status; never claim that logout completed. |
| ServerLogoutConfirmed | Stop treating the old cache as usable, commit the fence with bounded retries, and cancel/remove private in-memory queries. Do not navigate before both the server response and this phase marker are durable. | Signed-out transition may begin only after the phase commit. |
| FenceCommitted | Treat every old lease and snapshot as stale. Attempt physical snapshot deletion and matching marker resolution. Never restore the old snapshot, even if deletion is temporarily unavailable. | Login is allowed; cleanup may continue before or after navigation. |
| CleanupPending | Keep the persistent marker and gate private cache hydration/persistence. Retry is local cleanup only; it must not call server logout again. A successful login alone does not clear this state or authorize old-cache use. | Login page plus a persistent banner and Toast: “You're signed out, but we couldn't finish clearing your private Day Log data. Retry clearing data before continuing.” Button: Retry. |
| Resolved | Clear the pending record, ensure the old snapshot is removed or invalidated, then allow a new authenticated lease. A later successful login starts from a fresh/online cache and never restores the old snapshot. | Normal login and account initialization. |

If the user leaves the login-page Toast untouched, the marker remains durable across reloads. The app may authenticate the user, but the private provider stays gated until Retry completes. A different account must not inherit or use the prior account's lease.

### Cleanup, retries, and idempotency

- Use a bounded retry policy for generation advancement: fresh transaction per attempt, short backoff, then a durable fail-closed result. Never retry an aborted IndexedDB transaction object.
- Store the intended target generation once and accept read-back storedGeneration greater than or equal to targetGeneration as success. This handles a committed transaction whose response was lost and concurrent revocations that advanced the generation farther.
- Fence advancement, snapshot deletion, and marker resolution are independently retryable and idempotent. A missing snapshot is already clean; a matching operationId is required before clearing a marker.
- Once fence-committed exists, physical deletion failure is a cleanup/retention problem, not a reason to restore the old data. Keep the marker until cleanup succeeds so the user receives the retry affordance.
- Do not add localStorage as a second correctness authority. IndexedDB generation is authoritative; BroadcastChannel only accelerates active-tab cleanup.
- Check the durable generation before accepting restored data and after provider hydration. If either check observes a mismatch, purge stale memory immediately and prevent the next persist.

### Sequence

~~~mermaid
sequenceDiagram
    actor User
    participant UI as App/UI
    participant IDB as IndexedDB lifecycle
    participant API as Session API
    participant Router

    User->>UI: Click Log out
    UI->>IDB: Commit logout-pending(accountId, operationId)

    alt marker write fails
        IDB-->>UI: Storage error
        UI-->>User: Stay signed in; show retryable error
        Note over UI,API: Do not call server logout
    else marker committed
        UI->>API: Await server logout
        alt definitive server failure
            API-->>UI: Failure
            UI->>IDB: Clear matching pending marker
            UI-->>User: Preserve session and private cache
        else server logout succeeds
            API-->>UI: Success
            UI->>IDB: Commit server-logout-confirmed
            loop bounded fresh transactions
                UI->>IDB: Set target generation and read back fence
            end
            alt fence cannot be committed
                UI-->>User: Stay fail-closed; offer retry
            else fence committed
                UI->>IDB: Commit fence-committed
                UI->>UI: Stop persistence and purge private memory
                UI->>Router: Navigate to login
                UI->>IDB: Delete snapshot and clear matching marker
                alt cleanup fails
                    IDB-->>UI: Keep cleanup-pending
                    UI-->>User: Toast/banner with Retry
                    User->>UI: Click Retry
                    UI->>IDB: Retry local cleanup only
                else cleanup succeeds
                    IDB-->>UI: Resolved
                    UI-->>User: Allow normal login/cache initialization
                end
            end
        end
    end
~~~

### Required browser coverage

Prioritize deterministic, observable browser behavior:

1. Corrupt/unavailable IndexedDB falls back to an empty online cache without breaking rendering.
2. pageshow, visibility-resume, and focus detect a generation mismatch after a missed BroadcastChannel message and purge stale in-memory state before reuse.
3. A marker-write failure proves that the server logout request is not sent.
4. Server logout failure preserves session/cache; successful logout is awaited before navigation; ambiguous logout remains fail-closed.
5. Generation advancement retries with a fresh transaction, reads back the target, and does not double-increment after a lost response.
6. A stale restore or persist cannot win after fence-committed, even when snapshot deletion fails.
7. cleanup-pending renders the persistent Toast/banner and Retry clears only local cleanup state; successful login alone cannot hydrate the old snapshot.
8. Marker resolution, snapshot deletion, account isolation, allow-list enforcement, and the final post-hydration fence check are covered with actual IndexedDB.

Timer-based persist/restore race tests are optional only when they are deterministic. The durable generation fallback is the primary correctness proof; do not make the guarantee depend on sleep timing.

## Comments

- 2026-09-05: Recorded the agreed fail-closed logout design: durable marker before server logout, confirmed server logout before navigation, bounded/idempotent generation fencing, cleanup-pending login recovery, persistent Retry UI, and no second storage authority.
