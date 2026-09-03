# 02: Add bounded Day Log synchronization

**What to build:** An authenticated client reconciles a contiguous range of at most 31 Day Log dates through `POST /daylogs:sync`. Common unchanged ranges receive `204 No Content`; otherwise the client receives only changed or unloaded date slots. The endpoint avoids loading Food Entries when a narrow revision projection establishes that the entire request already matches.

**Blocked by:** None (can proceed independently of 01).

**Status:** ready-for-agent

- [ ] Add the `day_logs.version_number` migration/backfill and a positive `int32` domain/application representation. Ensure every response-visible Day Log aggregate write advances it atomically through the aggregate-root repository; do not add a child-entity write repository.
- [ ] Add presentation contracts for the bounded request manifest and sparse response slots. An omitted date is Unloaded, `null` is Known-empty, and a positive version is a server-owned comparison hint, never an authorization or write precondition.
- [ ] Add an application Day Log sync read use case and ports in Day Log terms. Keep HTTP status/input mapping in presentation and SQL rows/transactions in persistence infrastructure.
- [ ] Implement an infrastructure-owned coherent read snapshot: project requested user/date/version values first, then load full aggregates only for changed or unloaded slots.
- [ ] Return bodyless `204` only when every requested slot matches; otherwise return `200` with exactly the changed/unloaded slots. A successful status must make the requested range completely reconciled.
- [ ] Enforce the inclusive contiguous 31-date cap; preserve user isolation and reject malformed dates/manifests. Send `Cache-Control: private, no-store`, with no ETag, `If-None-Match`, `304`, or rollover-overlap metadata.
- [ ] Cover API contracts and HTTP/Postgres integration behavior: 31-date bound, user isolation, Known-empty semantics, unchanged `204`, sparse changed `200`, headers, coherent snapshot behavior, and atomic version advancement.
