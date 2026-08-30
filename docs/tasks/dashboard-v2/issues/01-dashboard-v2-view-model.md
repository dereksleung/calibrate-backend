# 01: Build the Dashboard V2 view-model transform

Status for Matt Pocock skills: ready-for-agent

**Blocked by:** None.

## What to build

Create the pure Dashboard V2 model mapper under `apps/web-frontend/src/verticals/dashboard/`. It maps the current `DayLogRangeResponse` into a single `DashboardV2ViewModel` for the seven-day nutrition overview, the two partial-history Habit cards, four Nutrition mini-card models, and per-nutrient analytics models.

Keep the mapper independent of React, TanStack Query, routes, DOM, and visual component props. The future 28-day food-contribution comparison helper must accept a chronological list of Day Logs, so it can calculate true comparisons once cached history is available; the current seven-day caller must produce the explicit provisional all-`New` result instead.

## Acceptance criteria

- The mapper calculates calories, protein, fat, and carbohydrates from all meal slots of every Day Log.
- Seven-day nutrition is oldest-to-newest and includes zero-valued known-empty and Empty Day Log dates.
- Habit grids contain 30 chronological cells: the oldest 23 are `unavailable`; the latest seven are completed based on Weight observations or Food Entries.
- A Food contribution aggregates one nutrient across Food Entries whose `name` strings are exactly equal.
- Total analytics includes every named contribution, sorted descending, with its amount and percentage of that nutrient total.
- Change calculation partitions any supplied dated history into the current local 14-day window and the preceding local 14-day window; it does not depend on receiving a particular number of days.
- When Food Entries exist only in the current window (including a partial current window) and none exist in the preceding window, every current Food contribution is `New` and the information banner is shown. Otherwise, the model calculates reductions, increases, removals (`-100%`), and new foods (`New`) from the available windows.
- Change data is grouped into `Reductions`, `Increases`, and `New Foods`, rather than returned as one mixed list. Reductions and increases use their calculated percentage changes; New Foods carry their current-window contribution.
- The sort direction reverses ordering within every group. By default, Reductions run from greatest reduction to smallest, Increases from greatest increase to smallest, and New Foods from greatest current contribution to smallest.

## Tests and verification

- Add focused unit tests for fully populated, known-empty, Empty Day Log, no-weight, case-different food-name, zero-baseline, removal, and sort-reversal cases.
- Run `npx nx run web-frontend:test`.
- Run `npx nx run web-frontend:typecheck`.

## Likely files

- `apps/web-frontend/src/verticals/dashboard/dashboard-v2-model.ts`
- `apps/web-frontend/src/verticals/dashboard/dashboard-v2-model.test.ts`
- Existing nutrition-total helpers, only if a reusable pure extraction avoids duplication without widening their public interface unnecessarily.
