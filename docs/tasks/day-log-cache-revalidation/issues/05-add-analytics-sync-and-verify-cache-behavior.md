# 05: Add deliberate analytics sync and verify cache behavior

**What to build:** Nutrient Analytics intentionally reconciles the most recent 28 dates only when its drawer opens, renders cached coverage while that work is pending, and reports trustworthy seven-day totals plus a complete 14-versus-14 comparison. Evidence demonstrates that the private cache and sync protocol deliver their intended performance/privacy behavior.

**Blocked by:** 01: Restore a private Day Log cache with a lifecycle fence; 02: Add bounded Day Log synchronization; 03: Compose Dashboard and Logs from validated date slots; 04: Patch a Day Log cache safely from Food Entry writes.

**Status:** ready-for-agent

- [ ] Hoist or connect drawer-open/selected-metric state so the data-composition layer can start the 28-date sync when the drawer opens without disturbing the drawer's focus restoration behavior.
- [ ] Do not fetch 28 dates before opening. On opening, compose cached `today - 27` through today material first; sync only when coverage is incomplete, unverified, or one-hour stale. Deduplicate repeat opens.
- [ ] Display `Updating — N/28 days available` for incomplete coverage. Do not represent unknown data as known empty, and leave Change pending until all 28 requested slots are confirmed.
- [ ] Keep Total to the most recent seven dates. Calculate Change from the current 14 dates versus preceding 14; add regression tests so a 28-day input cannot accidentally widen Total.
- [ ] Add privacy-safe measurement for cache restore/useful-view lifecycle, projection versus aggregate database work, request/response bytes, `204` ratio, and sync reason. Never emit Day Log, Food Entry, identity, session, or token content.
- [ ] Run the final browser and integration coverage for actual IndexedDB lifecycle, cross-tab revocation paths, sync/mutation correctness, calendar behavior, analytics coverage, and deterministic cache-hit/miss assertions rather than timing thresholds.
