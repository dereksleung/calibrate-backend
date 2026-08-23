# 01: Restore a private Day Log cache in Dashboard

**What to build:** A signed-in user returning to Calibrate sees a restored Seven-day view in Dashboard immediately from that user's persisted Day Logs, then receives a normal background refresh. The cache is safe for a shared browser, preserves Known-empty days distinctly from Empty Day Logs, and remains an optional performance benefit rather than a prerequisite for using the app online.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] After server session confirmation, restore only the current user's Day Log data and cache metadata; do not persist or restore authentication state.
- [ ] Retain persisted data for 30 days, clear it after successful explicit logout or account change, and preserve it when logout fails.
- [ ] Dashboard composes its Seven-day view from date-keyed Day Log entries, renders restored entries immediately, and starts a normal background range refresh.
- [ ] A Known-empty day remains cached as confirmed absence, while an Empty Day Log remains a present aggregate; unavailable or corrupt IndexedDB falls back to an empty online cache.
- [ ] Behavior-level tests cover account isolation, session-confirmed restoration, immediate Dashboard rendering, background correction, storage failure, retention, and logout clearing.

