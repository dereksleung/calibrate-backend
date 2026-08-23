# 04: Revalidate the six-day rollover overlap

**What to build:** When a user returns on the next local calendar day, the app preserves the six cached historical dates and conditionally validates them in parallel with loading the new date. Unchanged history avoids Day Log and Food Entry rehydration; changed history is replaced correctly.

**Blocked by:** 03: Conditionally revalidate unchanged Day Log ranges.

**Status:** ready-for-agent

- [ ] A successful Seven-day response supplies a server-issued opaque validator for tomorrow's six-day historical overlap in validated response metadata, separate from the response ETag.
- [ ] At date rollover, the client conditionally requests that exact overlap and requests the new date in parallel when the overlap validator is available.
- [ ] A not-modified overlap keeps cached historical entries; a modified overlap replaces them before the composed Seven-day view settles.
- [ ] The fallback remains a normal full Seven-day range read when no valid overlap validator exists.
- [ ] Behavior-level contract, HTTP, API-client, and Dashboard tests cover unchanged overlap, changed historic data from another device, absent validator fallback, and the absence of a general delta-sync protocol.

