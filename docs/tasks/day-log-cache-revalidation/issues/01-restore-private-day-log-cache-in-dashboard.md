# 01: Restore a private Day Log cache with a lifecycle fence

**What to build:** A signed-in user returning to Dashboard restores only that confirmed account's allow-listed Day Log slots and validation metadata from IndexedDB. The cache is an optional performance feature, remains isolated across accounts and tabs, and cannot be restored or re-persisted by a stale tab after a successful logout or confirmed session loss.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Keep the root `QueryClientProvider`. Conditionally mount a same-client `PersistQueryClientProvider` below server-confirmed authenticated content, keyed by account ID and cache-lifecycle generation so it restores once for each lease.
- [ ] Replace anonymous Day Log keys with account-scoped date-slot and validation-metadata keys. Dehydrate only the explicit Day Log allow list; exclude session/auth data, tokens, mutations, and unrelated queries.
- [ ] Build a native asynchronous IndexedDB persister with separate `persistedClients` and `cacheLifecycle` stores. A lifecycle generation must survive snapshot deletion.
- [ ] Have restore read fence and snapshot in one transaction and accept only a matching `{ accountId, generation }` lease. Have persist check the fence and write the snapshot in one overlapping read-write transaction; `removeClient` removes a scoped snapshot but never the fence.
- [ ] After successful server logout or conclusively confirmed session loss, atomically increment the account fence and delete its snapshot, stop persistence, cancel/remove private in-memory queries, and navigate to login. Failed logout or transient refresh failure must preserve cache and session state.
- [ ] Broadcast a committed revocation for prompt active-tab cleanup. Independently check the durable fence on mount, `pageshow`, visibility return, focus, and every 15 seconds while visible. Do not claim zero-frame removal of pixels already painted in a suspended tab.
- [ ] Explicitly prune Day Log slots 30 days after their last successful validation before restore/persist. Use a no-op persister and empty online cache on IndexedDB denial/corruption; storage errors must not break queries or rendering.
- [ ] Add browser-level actual-IndexedDB coverage for session-gate-first restoration, account isolation, allow-list enforcement, failed storage, successful and failed logout, missed broadcast/resume, and persist/restore races with a revocation transaction.
