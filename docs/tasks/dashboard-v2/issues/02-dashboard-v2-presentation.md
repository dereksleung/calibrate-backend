# 02: Build Dashboard V2 presentation components

Status for Matt Pocock skills: ready-for-agent

**Blocked by:** 01.

## What to build

Create `DashboardV2Page` and its colocated presentational components. The page receives a `DashboardV2ViewModel` and callbacks; it fetches no data. It renders the centered Aurora-fade page, the static seven-day overview, Habits, and Nutrition in that order.

Implement the agreed compound components:

- `SevenDayNutrition.Row`, `SevenDaySummaryStat`, and `SevenDayBarChart`.
- Page-local `MiniAnalyticsCard.Title`, `Subtitle`, `ChartArea`, `Separator`, `SummaryStat`, `GoDeeperIcon`, and `BottomSummary`.

Every card is a titled `section`. The `interactive` boolean makes only its `BottomSummary` a native button with an explicit accessible analytics name and chevron; the noninteractive form is not focusable and renders no chevron.

## Acceptance criteria

- The page has one `h1`, Dashboard, followed by `h2` section headings for Seven-day nutrition, Habits, and Nutrition; MiniAnalyticsCard titles are `h3` elements.
- It uses `subtle-aurora-fade-page-background` for the page and `glass-card` for every chart card.
- The content remains centered with `max-w-[450px]` at every breakpoint, as specified in the current PRD.
- Habits and Nutrition are always two columns, including at 320px; card content wraps or truncates intentionally without horizontal overflow.
- The seven-day overview is static and has an accessible text alternative for chart values.
- Nutrition summary buttons are keyboard reachable and announce the selected nutrient; Habit summaries are not interactive.

## Tests and verification

- Add component tests for heading hierarchy, card roles, interactive/noninteractive BottomSummary behavior, chart text alternatives, and 320px-safe layout classes.
- Add Storybook stories for the card primitives and composed page sections, covering seven-day values, partial 30-cell Habit history, each Nutrition metric color, and interactive versus static BottomSummary variants.
- Run `npx nx run web-frontend:test`.
- Run `npx nx run web-frontend:typecheck`.

## Likely files

- `apps/web-frontend/src/pages/dashboard/DashboardV2/DashboardV2Page.tsx`
- `apps/web-frontend/src/pages/dashboard/DashboardV2/components/SevenDayNutrition.tsx`
- `apps/web-frontend/src/pages/dashboard/DashboardV2/components/MiniAnalyticsCard.tsx`
- Colocated `*.test.tsx` and `*.stories.tsx` files.
