# Implementation Plan: Live seven-day Goals charts

## Goal

Replace the Goals page’s hard-coded seven-day weight and fat chart values with live data from the existing authenticated day-log range query. Keep the data contract stable and let the frontend build the presentation-specific chart data.

## Resolved design

- Scope is the two visible seven-day cards: the weight line chart and fat bar chart.
- The Fats drawer remains the existing 28-day fixture view and is explicitly out of scope.
- The range is the current local date plus the six preceding local calendar dates, inclusive and ordered oldest to newest.
- Goals calls the existing useDayLogRange operation with the same range shape and query-key family used by Dashboard. No new endpoint or API contract is needed.
- The UI derives chart data from DayLogRangeResponse:
  - weight values come from each Day Log’s weight;
  - fat values sum all meal entries through the existing nutrition-total helper;
  - fat bars use the existing 60g placeholder nutrition target;
  - x-axis labels are dynamically derived weekday abbreviations for all seven slots.
- Missing weights remain null in the chart data. Recharts should use connectNulls so nearby recorded points are visually connected without inventing inferred values.
- The weight-change label is the latest observed weight minus the earliest observed weight in the range. If fewer than two observations exist, show a neutral placeholder rather than zero.
- Initial loading shows a usable loading state; an initial failure shows an inline retryable error. During a background refresh failure, keep the last successful charts visible and expose a non-blocking retry affordance.
- This task is read-only for weight because the current weight UI has no active mutation path. Future weight writes must invalidate both the selected-day query and the day-log range prefix.

## Current state

- Goals currently declares weeklyWeightData and weeklyFatData fixtures in apps/web-frontend/src/pages/goals/Goals.tsx.
- The existing range hook lives in packages/api-client/src/day-logs/get-day-log-range.ts and validates the shared DayLogRangeResponse contract.
- Dashboard already derives seven-day nutrition data from the same response in apps/web-frontend/src/verticals/dashboard/dashboard-nutrition-model.ts.
- The shared nutrition helper already sums calories, fat, protein, and carbohydrate values across nullable meal arrays.
- Food-entry saves already invalidate both the selected-day key and all range keys.
- No dedicated Goals page live-data test exists today.

## Architecture impact

This is a web presentation/UI change plus a small shared frontend date-range extraction. It does not modify backend domain/application/infrastructure layers, API contracts, or the shared API-client operation.

## Implementation tasks

### 1. Share the local rolling seven-day range calculation

Extract the local-date range calculation currently owned by the Dashboard model into a neutral frontend helper. Update Dashboard to use the helper and have Goals use the same helper, so both pages request identical startDate and endDate values and can share the TanStack Query cache entry.

Keep date-only arithmetic local-safe: format the browser’s local date as YYYY-MM-DD and subtract six local calendar days. Preserve tests for month/year boundaries.

Likely files:

- apps/web-frontend/src/shared/date/local-date-range.ts (new)
- apps/web-frontend/src/verticals/dashboard/dashboard-nutrition-model.ts
- apps/web-frontend/src/verticals/dashboard/dashboard-nutrition-model.test.ts

### 2. Add a frontend-owned Goals chart-data builder

Start with a pure buildGoalsChartData function in apps/web-frontend/src/pages/goals/Goals.tsx. It should accept DayLogRangeResponse and return the exact data and metadata needed by the two chart cards. Keep the function colocated with the page while it remains small and page-specific.

Extract it into a focused goals-analytics chart-data module only if the Goals page becomes unwieldy, the calculation gains substantial complexity, or another consumer needs the same transformation. The extraction should preserve the same pure interface and move its direct tests with it.

The builder should:

- preserve all seven response slots and their chronological order;
- derive the current weekday abbreviation from each ISO date;
- map nullable weights without replacing nulls;
- calculate the first-to-last observed weight change from actual non-null observations;
- return daily fat totals using getDayLogNutritionTotals;
- apply DAILY_TARGETS.totalFatGrams consistently;
- expose a small typed result that can be tested without importing Recharts.

### 3. Wire Goals to the existing TanStack query

Update Goals to call useDayLogRange(apiTransport, range), remove the hard-coded weekly arrays and 58g fixture limit, and pass the buildGoalsChartData result into the chart components.

Update the weight chart to:

- use dynamically derived weekday labels on the x-axis;
- accept nullable weights and enable visual connection across missing values;
- show the live first-to-last change label;
- describe values as weight in pounds rather than “pounds lost”;
- avoid rendering a fabricated line when there are no observations.

Update the fat chart to consume live daily totals and the canonical 60g limit. Keep its existing click behavior and Fats drawer navigation.

Add loading and failure states around the live chart region using the Dashboard’s existing accessible patterns:

- pending with no cached data: preserve the page shell and show chart-card skeletons with a status label;
- initial error with no cached data: show an alert and Try again action wired to refetch;
- background error with cached data: retain the chart and show a non-blocking retry affordance.

Leave the Active Program, Journey, and 28-day FatsAnalytics content unchanged.

Likely files:

- apps/web-frontend/src/pages/goals/Goals.tsx
- apps/web-frontend/src/pages/goals/Goals.test.tsx (new, if direct builder tests are needed)
- apps/web-frontend/src/pages/goals/goals-live-analytics.integration.test.tsx (new)

### 4. Add focused tests

If buildGoalsChartData remains colocated, add direct pure-function coverage in Goals.test.tsx. If it is extracted, move that coverage beside the extracted module. Cover:

- seven slots with dynamically derived weekday labels;
- weight values, null observations, first-to-last change, and insufficient observations;
- fat totals spread across breakfast, lunch, dinner, and snacks;
- known-empty days producing missing fat slots rather than zero-valued bars, with the chart’s missing-value treatment visually bridging them, plus the 60g limit;
- range order remaining oldest to newest.

Add goals-live-analytics.integration.test.tsx covering:

- the inclusive seven-day request and current API path;
- live weight and fat values reaching the rendered chart region;
- x-axis labels changing with the requested dates;
- loading state;
- initial error, retry, and successful refetch;
- background refetch failure retaining the last successful chart data;
- range invalidation causing a mounted Goals view to refresh.

Update Dashboard model tests only as needed for the extracted date-range helper. Do not add API-client or backend tests because the existing range operation and contract are unchanged.

## Acceptance criteria

- Goals never renders the old seven-day fixture numbers after the live query is wired.
- The two seven-day charts request and consume exactly one existing day-log range response.
- The x-axis shows seven dynamically derived weekday labels in response order.
- Missing weight observations do not become zero or new data points; the rendered line visually connects nearby observations.
- Fat bars use summed live food-entry data and the existing 60g target.
- Known-empty Day Log slots do not render zero-fat bars; the chart visually bridges missing slots without fabricating a value.
- Initial loading and error states do not show misleading fixture values.
- A background refresh failure preserves the last successful charts.
- Dashboard and Goals can share the same range cache entry when mounted for the same local dates.
- No backend route, API contract, dependency, migration, or 28-day drawer work is introduced.

## Verification

Run the smallest affected frontend tests first, then:

- npx nx run web-frontend:test
- npx nx run web-frontend:typecheck

Manual smoke test:

1. Open Goals with a partially populated seven-day history.
2. Confirm the x-axis labels reflect the current week.
3. Confirm missing weights are visually bridged but do not appear as zero.
4. Add a food entry through the existing flow and confirm the fat chart refreshes after range invalidation.
5. Force an initial request failure and a background refetch failure to verify both error behaviors.

## Risks and follow-up

- The range response contains full Day Log payloads; this is acceptable for seven dates but may not be appropriate for month or multi-month charts.
- The current weight entry control is not wired, so live weight changes depend on future write-path invalidation.
- The 28-day drawer still uses fixtures and will need a separate range/aggregation design when that view is brought live.
- A page left open across local midnight will need a future date-rollover trigger if continuous rollover without navigation becomes a requirement.

## Open questions

None for this scope.
