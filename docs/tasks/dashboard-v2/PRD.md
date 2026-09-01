# Dashboard V2

## Goal

Replace the Dashboard route with a mobile-first overview that presents a seven-day nutrition summary, Habits, and Nutrition. The page uses the existing subtle Aurora fade background and glass-card treatment; its content is centered and capped at 450px for all breakpoints. The Header and page content share the same centered content frame and horizontal gutter so the Header title aligns with the page content's left edge and the Header's right-most element aligns with its right edge.

## Header/content alignment

The Header's inner content wrapper—not the full-width Header background—must use the same max width and horizontal whitespace padding as the Dashboard V2 page content. At mobile and desktop widths, the Header title/brand starts on the same left edge as the page content, and the right-most account or sign-up action ends on the same right edge. Define the shared max-width and gutter values once in an appropriate web-frontend layout token, helper, or class and consume them from both the Header and Dashboard V2 page; do not duplicate the values in separate component class strings.

## Settled decisions

- `DashboardV2Container` fetches the live seven-day Day Log range. It supplies a Dashboard V2 view model to `DashboardV2Page`; the page owns presentation, layout, and local drawer-selection state.
- The shared `@calibrate/api-client` package remains unchanged in this delivery. Renaming it to `@calibrate/frontend-core` and changing its module interface are deferred.
- `apps/web-frontend/src/verticals/dashboard/dashboard-v2-model.ts` owns the pure `DayLogRangeResponse` to `DashboardV2ViewModel` transform. `DashboardV2Container` supplies it to TanStack Query's `select`, so the page receives its view model while the shared query cache retains generic Day Log data.
- `MiniAnalyticsCard` is page-local and composes `MiniAnalyticsCard.Title`, `MiniAnalyticsCard.Subtitle`, `MiniAnalyticsCard.ChartArea`, `MiniAnalyticsCard.Separator`, `MiniAnalyticsCard.SummaryStat`, `MiniAnalyticsCard.GoDeeperIcon`, and `MiniAnalyticsCard.BottomSummary`. Its root is a titled `section`, not an article. When `props.interactive` is true for `MiniAnalyticsCard`, only `BottomSummary` is a native button with an explicit analytics accessible name and the Go Deeper icon; otherwise it is a noninteractive element with no icon. Nutrition cards are interactive; Habits cards are not.
- `SevenDayNutrition` has structural `Row` elements, each composed of `SevenDaySummaryStat` and `SevenDayBarChart`.
- The Nutrition and Habits mini-card grids always use two columns, including at 320px. The page heading is `Dashboard`; its sections are Seven-day nutrition, Habits, and Nutrition.
- The Header's inner content uses the same centered max width and horizontal gutter as Dashboard V2 main content. Its title/brand and right-most account or sign-up action align with the page content edges at all supported widths. The shared max-width and gutter values live in one appropriate web-frontend layout token, helper, or class consumed by both surfaces.
- The seven-day overview is a static accessible summary. There is no Nutrition `See All` action in this delivery.
- The Nutrition cards open a Dashboard-owned drawer similar to the drawer for fats found currently in src/pages/Goals.tsx. `NutrientAnalytics` is reusable for calories, fats, protein, and carbohydrates. Its Total tab aggregates all Food Entries with exactly matching names across the available seven days, orders by contribution descending, and shows each amount and share of the selected nutrient total without thumbnails.
- The Change tab defaults to ordering from highest reductions first to highest additions, can reverse that order, and groups Food Entries by their exact recorded names. For the full 28-day implementation it compares the current local 14-day window with the preceding local 14-day window; removals are `-100%` and foods absent in the earlier window are `New`.
- Habits use the live seven-day range only: a Weigh-In day has a Weight observation and a Food Logging day has at least one Food Entry. The 23 earlier squares remain neutral gray until the deferred history work exists.
- Drawer rows have no food thumbnails because the current Food Entry contract has no image URL.

## Deferred history-backed Change calculation

The first delivery can compute Total from the seven live days. Its Change data model can also compute all 28 days but for any set of data where there are no food entries for the preceding local 14-day window marks all available food contributions from the current 14-day window as `New`; it does not claim to compute a real two-week comparison until the date-keyed 30-day IndexedDB Day Log cache and conditional revalidation work is available.

### First-delivery copy

**Title:** Food contribution change

**Subtitle:** Compares the most recent two weeks with the two weeks before.

**Blue information banner:** More history is needed to compare changes. Foods logged in the last 7 days are shown as New.

### Requested future insufficient-history copy

When the history cache is available but has not yet accumulated two complete consecutive 14-day windows, replace the first-delivery banner with:

> More history is needed to compare changes. "New" foods are foods from the most recent 2 weeks not found in the 2 weeks before that.

This wording describes the intended meaning of `New`, but it must not be used while only seven days are available. Once both comparison windows are complete, omit the banner and show calculated changes.

## Related deferred work

`docs/tasks/day-log-cache-revalidation/` owns the user-scoped 30-day IndexedDB Day Log cache and cheap conditional revalidation. Dashboard V2 should contain a focused inline TODO at its seven-day fetch pointing to that effort; it must not create a parallel cache design.
