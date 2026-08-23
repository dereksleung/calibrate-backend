# 02: Reuse the Day Log cache in Goals and after Food Entry writes

**What to build:** A signed-in user sees Goals use the same date-keyed Day Log source as Dashboard, and a successful Food Entry write refreshes the exact affected Day Log and every visible summary that contains it, including for an historic date.

**Blocked by:** 01: Restore a private Day Log cache in Dashboard.

**Status:** ready-for-agent

- [ ] Goals composes its Seven-day view from the existing date-keyed Day Log cache rather than maintaining an independent range payload.
- [ ] Moving between Dashboard and Goals reuses already-loaded Day Logs without a duplicate data source.
- [ ] Successful Food Entry writes refresh the affected date and active Dashboard or Goals summaries, including writes to historic Day Logs.
- [ ] Unrelated historic Day Logs remain usable and are not globally invalidated by a single Food Entry write.
- [ ] Behavior-level tests cover shared Dashboard/Goals data, current and historic Food Entry updates, and precise cache refresh behavior.

