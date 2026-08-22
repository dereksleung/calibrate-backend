# 01: Render the live seven-day fat chart on Goals

**What to build:** Make the Goals seven-day view load the existing authenticated Day Log range and render live fat chart data for the user. The slice includes the shared rolling-date/cache seam, dynamic weekday labels, chart loading and retry behavior, and refresh after range invalidation. The existing 28-day Fats drawer remains unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] Goals and Dashboard request the same rolling seven-day range and can share the existing TanStack Query cache entry.
- [ ] The fat chart derives daily totals from all four meal sections and uses the existing 60g nutrition target.
- [ ] The x-axis contains seven dynamically derived weekday abbreviations in chronological order.
- [ ] Known-empty Day Log slots do not render zero-fat bars; the chart visually bridges missing slots without fabricating a value.
- [ ] Initial loading and failure states do not display fixture values, and retry refetches the range successfully.
- [ ] A background refresh failure retains the last successful chart data and exposes a non-blocking retry affordance.
- [ ] Existing food-entry range invalidation refreshes the mounted Goals chart.
- [ ] Focused pure chart-data and integration tests cover the live fat-chart path.
