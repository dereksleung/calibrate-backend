# 03: Conditionally revalidate unchanged Day Log ranges

**What to build:** A user revisiting the same Seven-day view receives a lightweight not-modified response when no visible Day Log has changed, while a changed Day Log returns the fresh full range. This relieves repeated backend aggregate loading during daily mealtime spikes without changing the visible Dashboard experience.

**Blocked by:** 01: Restore a private Day Log cache in Dashboard.

**Status:** ready-for-agent

- [ ] Every response-visible Day Log write advances a server-owned revision atomically with the aggregate-root write.
- [ ] An authenticated range read validates an exact range from a narrow user-scoped revision projection and returns either a full response with an opaque ETag or a bodyless `304 Not Modified` response.
- [ ] The shared API client treats not-modified as a successful typed result, reuses the existing date-keyed entries, and refreshes data when validation reports a change.
- [ ] Authenticated Day Log responses use `Cache-Control: private, no-cache` without `Vary: Cookie`; cross-origin operation exposes and permits the required validator headers when applicable.
- [ ] A successful Day Log mutation invalidates validation metadata for affected active ranges, and behavior-level HTTP, persistence, API-client, and Dashboard tests cover unchanged, changed, and user-isolated cases.

