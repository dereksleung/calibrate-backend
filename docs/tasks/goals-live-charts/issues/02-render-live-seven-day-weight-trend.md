# 02: Render the live seven-day weight trend on Goals

**What to build:** Complete the Goals seven-day view by replacing the weight fixture with the user’s Day Log weight observations from the already-live range response. The chart should show the current weekday labels, observed-weight trend, and first-to-last change while keeping missing observations visually connected without inventing values.

**Blocked by:** 01: Render the live seven-day fat chart on Goals.

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] Weight values come from actual Day Log observations across all seven requested slots.
- [ ] Missing weight observations remain missing data, are not converted to zero or inferred points, and are visually bridged by the chart.
- [ ] The weight-change label uses the earliest and latest observed weights in the range.
- [ ] Fewer than two observations produce a neutral change placeholder rather than a fabricated delta.
- [ ] The x-axis uses seven dynamically derived weekday abbreviations in chronological order.
- [ ] The tooltip describes the value as weight in pounds and no longer says “pounds lost.”
- [ ] The old weight fixture is removed and the existing Goals layout, chart interaction, and 28-day drawer behavior remain intact.
- [ ] Focused tests cover missing observations, change calculation, dynamic labels, and the completed live seven-day Goals view.
