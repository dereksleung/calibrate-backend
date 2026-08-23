# 05: Prove and measure Day Log cache effectiveness

**What to build:** Maintainers can verify the persisted-cache experience in a real browser and observe privacy-safe evidence that the cache and conditional revalidation reduce repeated backend work during daily usage.

**Blocked by:** 02: Reuse the Day Log cache in Goals and after Food Entry writes; 04: Revalidate the six-day rollover overlap.

**Status:** ready-for-agent

- [ ] Browser end-to-end coverage proves IndexedDB restoration across reload, user isolation, successful logout clearing, same-range conditional reuse, and next-day overlap revalidation.
- [ ] Measurement captures cache-restore latency, time to a usable Dashboard or Goals view, range database duration, response bytes, and conditional not-modified rate.
- [ ] Measurement never records Day Log, Food Entry, authentication, or other private wellness content.
- [ ] Automated checks use deterministic cache hit/miss and privacy assertions rather than flaky timing thresholds.
- [ ] The completed evidence identifies whether repeat-load pressure has moved from full aggregate reads to narrow validation reads and whether further synchronization work is justified.
