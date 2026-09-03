# 04: Patch a Day Log cache safely from Food Entry writes

**What to build:** A successful Food Entry write immediately updates the exact cached Day Log only when the client can prove it is applying the server delta to its direct predecessor. It avoids an immediate `sync` request and avoids globally invalidating all historical ranges during meal-time bursts.

**Blocked by:** 02: Add bounded Day Log synchronization; 03: Compose Dashboard and Logs from validated date slots.

**Status:** ready-for-agent

- [ ] Change the successful Food Entry creation contract to return the created entry, `dayLogId`, `previousVersionNumber`, and `versionNumber`. `previousVersionNumber` is `null` only when the write created a Day Log from known absence.
- [ ] Have the aggregate-root write calculate and return this delta atomically with the Food Entry and Day Log version update.
- [ ] Patch the canonical date slot only when its cached predecessor version exactly matches `previousVersionNumber`; update both Day Log data and version without triggering a follow-up sync.
- [ ] On an unloaded or version-mismatched slot, preserve a locally acknowledged result but mark the slot unverified. Do not falsely advance a partial stale aggregate; the next ordinary eligible sync reconciles server truth.
- [ ] Replace global range-key invalidation with precise affected-date metadata handling so unrelated historical data remains usable.
- [ ] Cover current and historical writes, create-from-known-empty, matching patch, mismatch/unloaded unverified state, cross-device stale predecessor, and proof that a successful write does not immediately request synchronization.
