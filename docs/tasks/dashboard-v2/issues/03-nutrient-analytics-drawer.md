# 03: Build reusable nutrient analytics drawer content

Status for Matt Pocock skills: ready-for-agent

**Blocked by:** 01, 02.

## What to build

Replace the fats-only analytics presentation with a presentational `NutrientAnalytics` module that accepts an explicit nutrient model for calories, protein, fat, or carbohydrates. Reuse the existing base Drawer primitives, but make Dashboard V2 own drawer selection and open state.

The Total tab renders the seven-day model. The Change tab uses the model's availability state: first delivery shows its blue informational banner and all-`New` rows; history-backed input later renders real two-week comparisons. Rows are text-and-value only: no remote or placeholder food thumbnails.

## Acceptance criteria

- A selected Nutrition card opens the drawer for its own nutrient; closing the drawer restores focus to the BottomSummary button.
- The drawer opens from the bottom on mobile and from the right on desktop, matching the existing Goals pattern.
- Tabs use accessible tab semantics and retain the selected nutrient while switching between Total and Change.
- Total shows all exact-name food contributions in descending amount order with unit-appropriate amounts and shares.
- Change is titled `Food contribution change` with the approved subtitle. The provisional seven-day banner uses the approved seven-day-safe copy.
- Change renders three titled sections in this order: `Reductions`, `Increases`, and `New Foods`. Each section contains only its corresponding grouped model rows and has a concise empty state when it contains none.
- Change has one accessible sorting control that reverses row ordering within every section; status never relies on color alone.

## Tests and verification

- Add component tests for all four nutrient labels and units, tab behavior, provisional banner, sorting-control accessible name and reversal, drawer focus return, and no image elements in food-contribution rows.
- Add Storybook stories for all nutrient variants, Total and Change tabs, the provisional all-`New` banner, populated Reductions/Increases/New Foods sections, and their empty-section states.
- Run `npx nx run web-frontend:test`.
- Run `npx nx run web-frontend:typecheck`.

## Likely files

- `apps/web-frontend/src/pages/dashboard/DashboardV2/components/NutrientAnalytics.tsx`
- `apps/web-frontend/src/pages/dashboard/DashboardV2/components/DashboardAnalyticsDrawer.tsx`
- Colocated `*.test.tsx` and `*.stories.tsx` files.
- Existing `apps/web-frontend/src/verticals/goals-analytics/components/FatsAnalytics.tsx`, only if the completed extraction can replace its duplicated presentation without widening this story.
