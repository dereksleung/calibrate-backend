# Persisted Day Log Cache and Conditional Revalidation

Status for Matt Pocock skills: ready-for-agent

## Problem Statement

Returning to Dashboard or Goals repeatedly makes the browser request and rebuild a rolling seven-day view even when most Day Logs are already known locally and have not changed. A later return on the same day should not require a new origin request just to paint the screen, and when the client does revalidate, the backend should not transfer or rehydrate unchanged Day Logs and Food Entries. If we save the seven-day data locally, then on the next calendar day, even with a local cache, the next calendar day still has no cheap way to validate the six-day overlap. The app also has no durable, user-isolated offline read cache for recently synchronized wellness data.

Calibrate's anticipated usage is daily, with concurrent request spikes around mealtimes as users record food and revisit their stats. Those peaks should not transfer or rehydrate the full seven-day food-entry payload on every visit, so repeat checks stay within free-tier egress. The solution must therefore cut origin request volume for rendering and in-session revisits, and make remaining revalidation cheap when the range is unchanged, while improving perceived load time—without exposing one user’s wellness data to another user of the same browser, weakening the existing cookie-backed session model, or making offline writes part of this story. First open after the freshness window may still hit the origin, but use the cheaper revalidation path.

## Solution

Persist authenticated, user-scoped Day Log query data in IndexedDB and make one Day Log query entry authoritative for each calendar date, including a cached known-empty day. Restore only the confirmed current user's data, and render Dashboard and Goals from those date-keyed entries immediately, so screen paint and switching between those views do not require a new origin request. Treat the range as fresh for one hour; activation and focus revalidate only if stale. On a successful food save, update the affected day’s cache from the mutation result and do not refetch the range. One hour freshness matches user behavior: a session usually is logging meals and checking stats quickly right when eating a meal, repeatedly using a single device, and then the user will go back to whatever else they were doing. Users generally will not switch between devices in a single session, so we can relax on needing absolute freshness and revalidating constantly during a single session.

The backend will give each Day Log an internal revision that advances atomically with every response-visible change. A range request uses a revision-only projection to derive an ETag for its exact response. A repeat request for the same range sends that ETag and receives `304 Not Modified` with no JSON body when unchanged, so the client reuses its cached days without transferring the seven-day representation or loading Food Entries. A changed range still returns the full 200 body. A full rolling seven-day response also carries an opaque validator for its next-day six-day overlap. At date rollover, the browser conditionally requests that overlap and requests the new day in parallel, so an unchanged overlap avoids loading its Day Logs and Food Entries.

## User Stories

1. As a signed-in Calibrate user, I want Dashboard to show my most recently synchronized seven-day view immediately, so that I can check my nutrition without waiting for a network round trip.
2. As a signed-in Calibrate user, I want Goals to use the same recent Day Log data as Dashboard, so that switching between those views does not reload the same history unnecessarily.
3. As a user temporarily offline, I want to read recently synchronized Day Logs, including days with no log, so that I can still inspect my recent nutrition history.
4. As a user who opens Dashboard several times in one day, I want unchanged data to validate without downloading the full range again, so that repeat visits are fast and use less network data.
5. As a user who opens the app on the next calendar day, I want the already-known six historical days to remain visible immediately, so that only the new day's state needs to catch up.
6. As a user whose historical Day Log changed from another device, I want background validation to correct stale cached data, so that the app does not silently show outdated nutrition information.
7. As a user who adds a Food Entry, I want the affected Day Log and any visible nutrition summaries to refresh, so that my dashboard and goals reflect the successful write.
8. As a user who adds a Food Entry to a past date, I want that historical Day Log to refresh just as reliably as today's, so that editable history remains accurate.
9. As a user with no Day Log for a date, I want that known-empty day to be cached distinctly from an unloaded day, so that the app does not repeatedly request a confirmed absence.
10. As a user with an Empty Day Log, I want it to remain distinct from a known-empty day, so that a Day Log with no Food Entries and a possible weight observation is not treated as deleted.
11. As a user on a shared browser, I want another account never to see my persisted Day Logs, so that locally stored wellness data remains private.
12. As a user who explicitly logs out, I want my persisted Day Log cache removed only after logout succeeds, so that private data is cleared without treating a failed logout as successful.
13. As a user returning with a restored session, I want only my account's persisted data restored after the server confirms my identity, so that stale data from a previous account is never shown during session bootstrap.
14. As a user in private browsing or on a device that denies IndexedDB access, I want Dashboard and Goals to continue working online, so that local-storage failure does not block the product.
15. As a user who does not explicitly log out, I want old persisted Day Logs to expire after a bounded period, so that the offline benefit does not retain wellness data indefinitely.
16. As a user on a slow connection, I want the app to render cached Day Logs first and correct them in the background, so that freshness does not require a blank loading state.
17. As a user whose current Day Log is unchanged, I want a conditional response to reuse the existing data without a JSON body, so that normal revalidation is lightweight.
18. As a user whose overlap changed overnight, I want the app to load the changed historical range rather than assume it is unchanged, so that the rollover optimization remains correct across devices.
19. As a user with an expired or rotated access cookie, I want Day Log caching to remain independent of cookie values, so that normal session renewal does not fragment the useful application cache.
20. As a maintainer, I want measured evidence for cache restore time, revalidation results, response size, and database work, so that we only add a more complex synchronization protocol if this design proves insufficient.

## Implementation Decisions

- This is a cross-layer change affecting the web frontend, shared API client, API contracts and presentation layer, application read contracts, persistence infrastructure, and the Day Log aggregate's persistence lifecycle. It must preserve the backend's dependency direction: HTTP headers and status codes remain presentation concerns; application ports use Day Log query terms rather than database rows; Postgres owns transactions; and Food Entry writes continue through the Day Log aggregate-root repository.
- Add the official TanStack React persistence provider after the user installs it. The web app owns a small native IndexedDB persister rather than adding another storage library.
- Persist only Day Log data and cache-validation metadata. Do not persist authenticated-session data, access tokens, refresh tokens, or other authentication state.
- Namespace persisted storage by authenticated user ID. Confirm the server session before restoring that namespace, do not mount Day Log reads until restore is complete, and treat persistence failure or corrupt state as an empty cache. Explicit logout and account change clear both the in-memory data and the matching persisted namespace after the server logout succeeds.
- Retain persisted data for 30 days. Configure in-memory garbage collection for at least the same retention period, while treating freshness separately from retention.
- Make one date-keyed Day Log query entry the durable data shape. Populate it from every successful single-day or range response. A `null` result is a cacheable Known-empty day; it is not equivalent to an unloaded date. Range responses are composition and revalidation inputs, not the durable Day Log data shape.
- Dashboard and Goals compose their Seven-day view from date-keyed entries. They render restored entries immediately, then trigger background revalidation on first activation after hydration and on browser-focus return. They do not poll.
- Add a server-owned revision to the Day Log persistence record. It is not an HTTP contract or a client-computed value. Every response-visible Day Log write, including Food Entry creation and future weight changes, advances that revision in the same infrastructure-owned transaction as the underlying write.
- Add an application-level user-scoped Day Log range-version query. The Postgres adapter implements it as a narrow ordered projection of date and revision values using the existing user/date access pattern. It must not load Food Entries or reconstitute Day Logs when an unchanged range can be established.
- The presentation layer derives an opaque ETag for the exact authenticated range representation from the requested dates and the ordered range-version result. It handles `If-None-Match`, returns `304` without a response body when the range is unchanged, and otherwise loads and maps the full range. The shared API client represents not-modified as a successful typed result rather than an error or an empty JSON response.
- A successful rolling Seven-day response exposes a separate opaque validator for the next-day six-day overlap in its validated response metadata. It is not a second `ETag` response header. The browser stores and replays this server-issued value; it never derives a validator from revisions.
- On date rollover, when a valid persisted overlap validator exists, request the six historical dates conditionally and the new date in parallel. Reuse the six local dates after a `304`; replace them if the historical response is modified; then merge the new-date result. When no overlap validator exists, use the normal full rolling-range read.
- On a successful Day Log mutation, invalidate or refresh the affected date entry and any active validation metadata whose range contains that date. Do not invalidate unrelated historical Day Log data globally. The next visible composed view must reflect the successful mutation.
- Day Log responses use `Cache-Control: private, no-cache`. Omit `Vary: Cookie`: short-lived rotating access cookies would fragment HTTP-cache variants. The application-managed, user-namespaced cache is the source of durable reuse. If the web API is cross-origin, expose `ETag` to browser JavaScript and allow `If-None-Match` through CORS.
- Add measurement that captures persisted-cache restore latency, time to a usable Dashboard/Goals view, range endpoint database duration, response bytes, and conditional `304` rate. Do not log Day Log or Food Entry content in those measurements.

## Testing Decisions

- Tests assert externally observable behavior and contracts rather than query-builder calls, private persister internals, or exact method invocation sequences.
- Extend the existing Day Log HTTP route integration suite as the backend protocol seam. It must cover authenticated and unauthenticated requests, full-range `200` responses with ETags and overlap metadata, matching `If-None-Match` responses with `304` and no body, changed-range fallback to `200`, cache directives, and no data leakage between users.
- Add a PostgreSQL repository integration suite for revision behavior. It must prove that a response-visible Food Entry write advances its parent Day Log revision atomically, that a range-version read includes only the requested user's in-range Day Logs, and that an unchanged validation path does not require Food Entry loading. Use the existing Day Log repository tests as the nearby prior art, while keeping database behavior in the integration suite.
- Extend shared API-client range-read tests to assert outgoing validator headers, typed not-modified results, range metadata handling, and normalization of every successful range slot into date-keyed entries. Add focused transport tests for readable response ETags, `304` handling without JSON parsing, and ordinary error behavior remaining unchanged.
- Extend API-contract tests for the rolling-overlap metadata and the distinction between populated, Empty, and Known-empty Day Log response slots. Validate that malformed validator metadata cannot enter the client.
- Extend existing Dashboard integration coverage to assert immediate composition from cached date entries, background correction after a modified response, same-range `304` reuse, and the parallel rollover result. Extend Goals coverage so it consumes the same date-keyed source rather than creating an independent range cache.
- Add a focused Session Restoration Gate test that proves server-confirmed account identity precedes restoration, another account's persisted namespace is not hydrated, and unavailable IndexedDB falls back to online behavior. Extend the existing Header test to prove successful logout clears user-scoped in-memory and persisted Day Log data while failed logout preserves it.
- Add a browser end-to-end test beside the existing live Dashboard flow. It must use actual IndexedDB across reload, verify user-scoped isolation and explicit logout clearing, and exercise the real next-day overlap request sequence. This is the highest-confidence seam for browser persistence; JSDOM tests alone are insufficient.
- Add deterministic measurement tests or test hooks that demonstrate that no Day Log or Food Entry content is emitted in performance telemetry. Performance assertions should use stable behavior such as validator hit/miss classification rather than timing thresholds that would be flaky in CI.

## Out of Scope

- Offline creation, editing, deletion, queuing, retrying, conflict resolution, or synchronization of Food Entries, weight observations, or any other mutation.
- Deleting a Day Log or changing an existing Day Log into a Known-empty day. A future deletion story must define durable tombstone/version semantics before it reuses this cache protocol.
- An arbitrary client-supplied day-revision manifest, a general delta-sync endpoint, or a client-computed range-validator algorithm.
- Month- and quarter-scale analytics endpoints, expanded date-range limits, analytics summary projections, or a reporting read model.
- A server-side distributed cache, CDN Day Log cache, service worker cache, or caching of authentication credentials.
- Changing cookie lifetime, refresh-token rotation, access-session behavior, or the existing authentication model.
- Persisting data for more than 30 days, persisting data across explicit logout, or retaining data when IndexedDB cannot be safely restored.

## Further Notes

- The existing rolling range is capped at seven calendar dates. The current local calendar date remains the anchor for the Seven-day view.
- The normal same-range ETag path optimizes repeat visits within a day. The explicit six-day overlap validator is a narrow, intentional optimization for the first visit after a date rollover; it is not a generic synchronization mechanism.
- The source decision is ADR-0003, and the supporting primary-source research covers TanStack Query persistence and HTTP conditional request semantics.
- The user will run the approved official persistence-provider installation before implementation begins. No dependency installation is part of publishing this specification.
