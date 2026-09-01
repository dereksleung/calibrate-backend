# 04: Wire Dashboard V2 to the live Dashboard route and remove Goals

Status for Matt Pocock skills: ready-for-agent

**Blocked by:** 01, 02, 03.

## What to build

Create `DashboardV2Container` at the Dashboard page seam and make it the `/` route's component. It obtains the current rolling seven-day date range, uses the existing portable day-log range query options with TanStack Query's `select` set to the Dashboard V2 mapper, and passes the resulting view model, loading/error state, and drawer callbacks to `DashboardV2Page`.

Remove the superseded Goals page as part of this routing work: remove the `/goals` route and page surface, remove its user-facing navigation links, and update or remove the associated tests and generated route tree. Preserve reusable analytics components that Dashboard V2 still uses.

Align the Header with the Dashboard V2 content frame: cap the Header's inner content wrapper at the same width as the page content, use the same horizontal whitespace padding, and ensure the Header title/brand is left-aligned with the page content while the right-most account or sign-up element is right-aligned with it. Extract the shared max-width and gutter into one appropriate web-frontend layout token, helper, or class and reuse it from both surfaces.

Do not rename or change `@calibrate/api-client`. Do not add a 28-day endpoint or query. Add the focused inline TODO at the seven-day query call that points to `docs/tasks/day-log-cache-revalidation/` as the owner of the future user-scoped IndexedDB history and conditional revalidation work.

## Acceptance criteria

- `/` renders Dashboard V2 and no longer renders the superseded v1 layout.
- The superseded Goals page is removed: `/goals` is no longer a product route, its page is not reachable, and the shared navigation no longer links to Goals.
- The Header's title/brand aligns with the left edge of Dashboard V2 page content, and its right-most account or sign-up element aligns with the right edge, at mobile and desktop viewport widths.
- The Header's inner content is centered and capped using the same max-width and horizontal gutter as Dashboard V2 content; those shared layout values are defined once and reused rather than duplicated in component class strings.
- The seven-day query cache remains generic Day Log response data; the container receives selected Dashboard V2 data.
- Pending state retains the page structure with skeleton nutrition cards and neutral history cells.
- Error state retains page orientation, provides an inline retry, announces the failure accessibly, and never shows fixture values as live data.
- The V2 drawer opens from the selected Nutrition card; Habits cards remain static.
- Existing cache invalidation after a Food Entry mutation still refreshes the Dashboard's visible live values.
- The seven-day query call has this exact inline TODO, pointing to the existing cache work rather than defining another cache design:

  ```ts
  // TODO(day-log-cache-revalidation): Compose Dashboard V2 history from the user-scoped,
  // date-keyed 30-day IndexedDB Day Log cache and conditionally revalidate visible ranges.
  // Until that work lands, keep this seven-day query. The idea is that we will persist
  // up to 30 days of logs locally, and users generally will not change logs that are > 1 week
  // old as they will not remember what they ate then, so it will be inconvenient, so the
  // information will be available and fresh. A cheap revalidation will also be added.
  // See the PLAN and PRD at docs/tasks/day-log-cache-revalidation/ for details,
  // the 7 day plan there can be adapted to 28 days.
  ```

## Tests and verification

- Replace or update Dashboard integration coverage for loading, success, failure/retry, and Day Log range invalidation/refetch behavior.
- Update or remove Goals route/page and shared navigation coverage so it reflects the removal of `/goals`.
- Verify Header/page-content edge alignment at representative narrow and desktop viewports: 320px, 768px, 1024px, and 1440px.
- Run `npx nx run web-frontend:test`.
- Run `npx nx run web-frontend:typecheck`.

## Likely files

- `apps/web-frontend/src/pages/dashboard/DashboardV2/DashboardV2Container.tsx`
- `apps/web-frontend/src/pages/dashboard/DashboardV2/DashboardV2Page.tsx`
- `apps/web-frontend/src/routes/index.tsx`
- `apps/web-frontend/src/routes/goals.tsx` and the superseded `apps/web-frontend/src/pages/goals/` implementation
- `apps/web-frontend/src/shared/components/Header.tsx` and its layout/navigation tests
- The shared web-frontend layout token/helper/class definition, likely in `apps/web-frontend/src/styles.css` or a shared layout module
- Shared navigation components and tests that expose the Goals link, such as `apps/web-frontend/src/shared/components/Footer.tsx`
- `apps/web-frontend/src/pages/dashboard/dashboard-live-nutrition.integration.test.tsx`
- Existing `apps/web-frontend/src/pages/dashboard/Dashboard.tsx`, only as a compatibility re-export or removal once no route/import depends on it.
