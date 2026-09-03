# ADR-0003: Persist user-scoped Day Logs and revalidate rolling windows

- Shorter ADR - testing different skills for ADRs and documentation, from mattpocock

**Status:** Superseded by ADR-0004.

## Historic decision

Calibrate will persist only authenticated, user-scoped Day Log query data in IndexedDB for up to 30 days. The app restores that data only after the server confirms the current user, clears it from memory and IndexedDB on explicit logout or account change, treats known-empty days as cached data, and falls back to an empty online cache if storage is unavailable.

The durable Day Log data shape is one TanStack Query entry per date. The server retains range reads and adds a server-owned Day Log revision that changes atomically with every response-visible aggregate write. A range ETag is derived from a narrow user/date/revision projection: a same-range request replays it through `If-None-Match` and receives `304` when unchanged. A full rolling-week response additionally carries an opaque validator for its next-day six-day overlap; at date rollover, the client conditionally requests that overlap and requests the new day in parallel. Authenticated Day Log responses use `Cache-Control: private, no-cache`, but deliberately omit `Vary: Cookie` because short-lived rotating access cookies would fragment useful browser-cache variants. This does not introduce offline writes, deletions, an arbitrary delta-sync API, or month/quarter analytics.

ADR-0004 keeps the date-keyed, authenticated-only cache intent but replaces ETags and the rollover-specific protocol with a bounded `POST /daylogs:sync` manifest protocol. It also strengthens cross-tab cleanup from simple namespace deletion to a durable cache-lifecycle fence.
