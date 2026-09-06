# 04: Compose Dashboard and Logs from validated date slots

**What to build:** Dashboard and Logs compose cache-first Day Log views from account-scoped date slots and use bounded sync only when the user's active data needs validation. Logs displays calendar weeks naturally while avoiding requests from passive historical browsing.

**Blocked by:** 01: Restore a private Day Log cache with a lifecycle fence; 03: Add bounded Day Log synchronization.

**Status:** ready-for-agent

- [ ] Normalize every successful sync into date slots with `Known-empty`, `versionNumber`, `lastValidatedAt`, and unverified state. On a successful `200` or `204`, stamp every requested date as validated, including unchanged slots omitted from the `200` body.
- [ ] Compose Dashboard's rolling `today - 6` through today view from those slots. Cache-first rendering remains available when a sync is in flight, offline, or fails; later eligible activation can retry without blanking known data.
- [ ] Add the Logs Sunday-to-Saturday Calendar week presentation. The current Calendar week reuses Dashboard's rolling slots; future dates are disabled Upcoming state, never Known-empty. Prevent navigation to future weeks.
- [ ] Ensure merely scrolling historical weeks performs no sync. When the user explicitly selects historical date `D`, evaluate freshness only for D; if Unloaded, unverified, or one-hour stale, sync `D - 6` through D in the background after rendering cache first.
- [ ] Reuse fresh validation timestamps for nearby historic selections, deduplicate equivalent in-flight syncs, and never reintroduce a special date-rollover overlap request.
- [ ] Cover date-slot distinction, per-date validation timestamps, Dashboard reuse, Sunday/DST/year boundaries, future Upcoming state, history-scroll silence, historic `D-6..D` action, neighboring fresh skip, and offline/error cache-first behavior.
