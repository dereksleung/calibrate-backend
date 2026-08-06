# Implementation Plan: Daily Log Page

## Phase

Phase 3 task breakdown for `docs/tasks/log-page/PRD.md`. Do not start implementation until this task breakdown is reviewed.

## Planning Assumptions

- The PRD is the source of truth for scope and success criteria.
- The backend `day_logs.weight` column already exists, so daily weight persistence should not require a migration.
- `@tanstack/react-query` is not currently installed. It is acceptable for `@calibrate/api-client` to import React Query because TanStack documents React Query as working with React Native, but dependency installation still requires explicit approval before implementation.
- The current `DayLogRepository.findOrCreateByDateAndUserId()` should be corrected as part of day-log persistence work because it currently throws when the requested date has no row.

## Major Components

### Shared Contracts

- Add request/response contracts for:
  - Food search query and result shape.
  - Recent food result shape, including compact recency metadata.
  - Day-log weight update request.
- Keep schemas in `packages/api-contracts/src/` and export them from `packages/api-contracts/src/index.ts`.
- Use Zod schemas for backend route/query validation and for any frontend route search state where practical.

Dependencies:

- Backend presentation depends on shared schemas for validation.
- Frontend API client/helpers depend on shared response/request types.

### Shared API Client Package

- Create a new Nx package, planned as `packages/api-client` with package name `@calibrate/api-client`.
- The package owns shared React-platform API logic for:
  - Get selected day log.
  - Save food entry.
  - Update weight.
  - Search foods.
  - Get recent foods.
- The package depends on `@calibrate/api-contracts` for schemas/types.
- The package should expose a configurable client factory or functions that accept configuration such as `baseUrl`, `fetch`, and authentication options if needed.
- Prefer a small `ApiTransport` factory plus file-per-operation request modules over a single large API client object. The configured transport should be owned by the consuming app, while `@calibrate/api-client` exports portable request/query helper functions that accept the transport.
- See `docs/adr/0001-api-client-transport-and-operation-modules.md` for the API client architecture decision.
- The package may import React and `@tanstack/react-query` for reusable query options/hooks/mutations.
- Dependency shape: `@calibrate/api-client` should declare `@tanstack/react-query` as a peer dependency and dev dependency; consuming apps such as `web` and the future React Native app should declare `@tanstack/react-query` as app dependencies because they own `QueryClientProvider` and runtime platform setup.
- The package must not depend on React DOM, TanStack Router, browser globals, React Native-specific modules, or web UI primitives.
- Platform-specific setup remains app-owned: the web app owns router/provider/devtools wiring; the future React Native app owns React Native online/focus manager wiring.
- The future React Native app should be able to reuse the same request functions and React Query options/hooks with its own app-specific auth and platform setup.

Dependencies:

- API client package depends on shared contracts and, if approved, imports `@tanstack/react-query` with peer/dev dependency declarations.
- Web data layer depends on the API client package for request functions and shared React Query behavior.
- Backend route shape should be stable before finalizing API client method names and return types.

### Backend Domain And Application

- Extend `DayLog` with weight update behavior, likely `dayLog.updateWeight(weight)`, so weight remains owned by the aggregate.
- Add application DTOs for updating day-log weight.
- Extend `IDayLogService` with `updateWeight({ userId, date, weight })`.
- Extend `IDayLogRepository` with a targeted write such as `updateWeight(dayLogId, weight)`.
- Correct or replace `findOrCreateByDateAndUserId()` so adding food or weight to an empty selected day creates the day log instead of throwing.
- Keep food entry writes through `DayLogService.addFoodEntry()` and the aggregate.

Dependencies:

- Weight API depends on repository write support.
- Empty-day save behavior depends on corrected find-or-create behavior.

### Backend Food Search And Recents

- Store shared, trusted/provider-backed items in `food_catalog`; do not put user-specific meal, selected quantity, day-log, or ownership fields in this table. A catalog result contains the reusable name, optional brand, servings, and nutrition fields needed to begin food confirmation.
- Preserve `food_entries` as immutable historical snapshots of the selected catalog nutrition and serving data. An optional `food_catalog_id` records provenance, but catalog corrections must not rewrite prior logs.
- Populate the catalog through trusted provider imports and controlled provider lookup/upsert, keyed by provider/source identity. A future barcode scan may promote a publicly identified product into the catalog only after GTIN normalization/check-digit validation and trusted provider verification. Manually created foods remain user-private rather than entering the shared catalog.
- Make `GET /foods/search?query=<text>` a staged search. First, in parallel, query the local catalog and the authenticated user's matching food entries from the prior two weeks. Return the backend-ordered combined local result set when either has a hit. Only when both local sources return no hit may it call FoodData Central, upsert trusted mapped results into `food_catalog`, and return those catalog-shaped results. It should require a trimmed 3-character minimum, cap query length/tokens and results, return cursor-based pages, and parameterize all database operations.
- Store an order-independent full-text vector using the `simple` dictionary over food name and optional brand, weighting name above brand. A GIN index on this vector handles the normal all-token search and validated prefix-token typeahead query.
- Store a normalized concatenated `search_text` representation and add a `pg_trgm` GIN index. Use it only as a typo/partial-match fallback or ranking signal after the full-text path, not as the main relevance mechanism.
- Rank exact and prefix name matches above full-text rank, then fuzzy similarity and bounded catalog popularity. The frontend renders this backend order without re-ranking.
- Keep the three-day recent-food endpoint separate from the typed-search recent query. `GET /foods/recent` reads only the authenticated user's last three calendar days; the staged typed-search query may read matching entries from the prior two weeks. Neither path may leak private/custom foods into another user's results or the shared catalog.
- Debounce/cancel client requests and use the database indexes for the local stage. Protect the FoodData Central fallback with a short timeout, bounded result size, in-flight request coalescing, and a short-TTL normalized-query result/negative cache; use the existing/general request limit and obtain approval before changing rate-limit policy. Defer endpoint performance instrumentation and measurement, along with any broader Redis cache for local catalog results, to a later separately scoped decision.

Dependencies:

- Catalog search endpoint depends on shared contracts, the catalog schema/index migration, local catalog/recent query ports, and the guarded provider fallback.
- Provider ingestion depends on the catalog schema and runs only for a zero-local-hit fallback or an explicit import/barcode flow.
- Recent-food reads need two bounded paths: three calendar days for page entry and two weeks for matching typed search.

### Backend Presentation And Container Wiring

- Add or extend routes:
  - `GET /foods/search?query=<text>`
  - `GET /foods/recent`
  - `PATCH /daylogs/:date/weight`
- Validate query params, route params, and bodies with shared Zod schemas.
- Preserve auth middleware on all user-specific routes.
- Wire new services/adapters/controllers in `apps/backend/src/infrastructure/container.ts`.
- Ensure controller responses never expose `FOODDATA_CENTRAL_API_KEY` or provider internals.

Dependencies:

- Controller tests depend on service/controller interfaces being injectable.
- Container changes depend on finalized service and adapter constructors.

### Frontend Data Access

- Use `@calibrate/api-client` for common request/response logic.
- Use shared React Query options/hooks/mutations from `@calibrate/api-client` where they are portable across web and React Native.
- Add web-local wrappers only for web-specific concerns such as routing, provider placement, devtools, or UI-specific error handling.
- Preferred plan if dependency is approved: use TanStack Query in `@calibrate/api-client` for selected-day log fetching, mutation invalidation, and optimistic weight update.
- If TanStack Query is not approved, use page-local fetch/state first and keep the cache abstraction small enough to swap later.
- Use TanStack Router `validateSearch` for selected date if date is represented in the URL search params.
- Store enough selected-food context for route-level confirmation navigation. Prefer route-safe state/search params where practical, and handle missing or stale confirmation state by returning the user to search with an error/empty state.

Dependencies:

- Optimistic weight behavior depends on the chosen web query/cache approach.
- Food confirmation page save depends on selected-food context plus existing `POST /daylogs/:date/food-entries`.

### Frontend Page And Components

- Replace the current placeholder `Logs` page with a mobile-first daily log composition.
- Before starting any frontend UI task, ask the user for screenshots and describe what the task entails so they know which existing screens, states, and viewport sizes to capture. For example, say whether the task touches the daily log overview, search flow, confirmation flow, loading/error states, mobile viewport, or larger viewport layout.
- Page-local components:
  - Date stepper with previous/next day only.
  - Daily progress summary with placeholder targets and weight.
  - Meal sections for Breakfast, Lunch, Dinner, Snacks.
  - Empty meal and empty weight messages with habit/momentum copy.
  - Floating action button and bottom sheet.
  - Food search experience that renders backend-ordered results.
  - Food result rows with name, brand/source, serving, calories, and compact recent date label when applicable.
- Add a hidden route-level food confirmation page, planned as `apps/web-frontend/src/routes/logs/confirm-food.tsx` with page composition in `apps/web-frontend/src/pages/logs/ConfirmFood.tsx`.
- The confirmation page owns quantity, serving unit, and meal edits before save.
- Search result selection navigates to the confirmation page; it should not be just a drawer step.
- Consider TanStack Router View Transitions for search-to-confirmation navigation:
  - Use per-navigation `viewTransition: true` if this transition is unique.
  - Consider router-level `defaultViewTransition` only if multiple log workflow transitions should share the same behavior.
  - Keep normal navigation fallback for unsupported browsers.
- Use existing primitives first. If repeated styling suggests a `Button` variant or a new primitive, pause and ask with examples and a proposed API.
- Larger viewports may improve spacing and layout density but must not add macro detail to entry rows or meal summaries.

Dependencies:

- Page can start with mock/fixture data after API contracts define the expected shapes.
- Frontend UI should cover normal, empty, loading, and error states against contract-shaped fixtures before live backend wiring is available.
- Network-backed UI requires loading, empty, and error states.

## Implementation Order

Once the shared request/response contracts are known in `@calibrate/api-contracts`, mock frontend UI tasks can start against contract-shaped fixtures while backend endpoints, infrastructure adapters, and API-client transport work continue in parallel. Treat this as Contract-First Slicing: contracts first, then backend and frontend slices can independently build against the same agreed shapes before live integration.

## Sequential Vs Parallel Work

Sequential:

- Contracts before controller/frontend integration.
- Day-log repository/service changes before weight UI integration.
- Catalog schema and search indexes before local catalog-query implementation and live search wiring.
- Local catalog-query ordering before frontend live-data search display assertions.
- Provider ingestion can follow the catalog schema independently; it must not sit in the ordinary typeahead request path.
- Shared API client package before live web data wrappers and live page integration.
- TanStack Query dependency setup before implementing optimistic cache behavior.
- Confirmation route/context design before wiring search result selection.
- View Transitions strategy before adding transition CSS or router-level defaults.

Parallelizable after contracts:

- This is the main Contract-First Slicing lane: after `@calibrate/api-contracts` defines request/response shapes, frontend mock UI can proceed with contract-shaped fixtures while backend services/controllers and API-client transport are implemented separately.
- Backend weight persistence and backend food search can proceed independently.
- Frontend normal, empty, loading, and error state UI can proceed against contract-shaped mock data while backend endpoints are being finished.
- Shared API client package and frontend mock-state UI can proceed in parallel after contracts define expected shapes.
- Three-day recent-food backend query and search UI result-card design can proceed independently once their shared result shape is stable.
- Backend controller tests and frontend pure helper tests can be written alongside implementation.

## Risks And Mitigations

- Risk: TanStack Query is not installed.
  - Mitigation: ask before dependency installation. If approved, declare `@tanstack/react-query` in `@calibrate/api-client` as peer + dev dependency and in `web` as an app dependency. If not approved, isolate data-fetching logic so the first cut can use page-local state and later migrate cleanly.

- Risk: The shared API client accidentally becomes web-specific and hard to reuse in React Native.
  - Mitigation: allow React Query, but keep `@calibrate/api-client` free of React DOM, TanStack Router, DOM APIs, React Native-specific modules, and UI state; inject `fetch`/base URL where needed.

- Risk: React Query platform behavior differs between web and React Native.
  - Mitigation: keep platform setup outside `@calibrate/api-client`; web and React Native apps configure their own providers, devtools, online manager, and focus manager.

- Risk: A new package is generated with targets/config that do not match current workspace package conventions.
  - Mitigation: use the `nx-generate` workflow in Phase 3, dry-run first, and compare against `packages/api-contracts` before committing generated files.

- Risk: FoodData Central response shape is noisy and provider-specific.
  - Mitigation: keep provider parsing and catalog upsert mapping inside infrastructure; the search endpoint returns only app-owned catalog results.

- Risk: Shared catalog data is duplicated, unverified, or accidentally polluted by a user's manual food.
  - Mitigation: upsert provider data by stable source identity, use a validated normalized barcode only for trusted barcode/provider data, record verification status, and keep manual foods in a user-private store.

- Risk: Catalog typeahead regresses as the catalog grows or receives frequent queries.
  - Mitigation: use GIN full-text and trigram indexes, enforce bounded input/results and cursor pagination, and debounce/cancel client requests; only the zero-local-hit provider fallback receives a short-TTL result/negative cache in this story. Defer performance measurement and any broader shared cache to a later separately scoped decision.

- Risk: Fuzzy matching obscures exact or prefix food-name matches.
  - Mitigation: rank exact/prefix name matches before full-text rank and use trigram similarity only as a fallback/ranking signal.

- Risk: Recent-food reads become expensive as a user's history grows.
  - Mitigation: keep separate bounded paths: last three calendar days for page-entry recents and the authenticated user's prior two weeks for typed matching; index each user/date join and filter before adding a shared cache.

- Risk: No-result typeahead queries cause FoodData Central latency, cost, or rate-limit pressure.
  - Mitigation: call the provider only after both local sources miss, enforce timeout and bounded response size, coalesce identical in-flight queries, cache short-lived positive and negative normalized-query outcomes, and use the existing/general request limit unless a separately approved rate-policy change is made.

- Risk: Empty selected days fail on save because current repository find-or-create behavior throws.
  - Mitigation: fix find-or-create early and cover it in service/repository-level tests where practical.

- Risk: Weight optimistic UI diverges from server state.
  - Mitigation: rollback on mutation failure and invalidate/refetch the selected day log after success.

- Risk: Confirmation page is opened without selected-food context, such as via refresh or direct URL entry.
  - Mitigation: design the route to handle missing/stale state explicitly by returning to search or showing a recoverable empty state.

- Risk: View Transitions support varies by browser.
  - Mitigation: treat View Transitions as progressive enhancement and keep ordinary route navigation fully functional.

- Risk: Router-level `defaultViewTransition` applies motion too broadly.
  - Mitigation: start with per-navigation `viewTransition: true` for search-to-confirmation unless multiple log workflow transitions need the same animation.

- Risk: UI primitive reuse creates one-off styles or premature variants.
  - Mitigation: keep page-local composition first; ask before adding variants or new primitives.

- Risk: FoodData Central key leaks.
  - Mitigation: read/decrypt `FOODDATA_CENTRAL_API_KEY` only server-side with `dotenvx.get` during backend startup, cache the resolved value in memory, inject it into the adapter/configuration, and assert response contracts do not include configuration fields.

## Verification Checkpoints

These checkpoints are scheduled moments to run additional tests, checks, and manual verification after the verification in each defined task in the Phase 3 Task Breakdown. They are not intended to define commit boundaries. Commit according to `AGENTS.md` section "Story Branch And PR Gates", even if that means committing before, between, or after these verification checkpoints.

Final Checkpoint: End-to-end manual smoke

- `npx nx run backend:test:e2e`
- `npx nx run web:test:e2e`
- `npx nx run backend:dev`
- `npx nx run web:dev`
- Manually verify previous/next day navigation, empty day display, weight logging, food search, recent foods, confirmation, save, and totals update.

## Decisions Recorded

1. TanStack Query dependency setup: approved. `@calibrate/api-client` should import React Query and declare it as peer + dev dependency; `web` should declare it as an app dependency because it owns `QueryClientProvider` and devtools/provider wiring.
2. Shared API client package name/path: approved as `packages/api-client` with package name `@calibrate/api-client`.
3. Hidden confirmation route path: approved as `/logs/confirm-food`.
4. Search-to-confirmation View Transition strategy: start with per-navigation `viewTransition: true`. Meal add buttons leading into search do not justify router-level `defaultViewTransition`; consider `defaultViewTransition` later only if multiple workflow route transitions need the same motion.
5. `GET /foods/search` minimum query length: 3 characters.
6. `PATCH /daylogs/:date/weight` response shape: return the updated `DayLogResponse`.

## Review Gate

- [x] Plan reviewed.
- [x] Dependency decision recorded for TanStack Query.
- [x] Shared API client package name/path recorded.
- [x] Confirmation route path and transition strategy recorded.
- [x] API response shape decision recorded for weight update.
- [x] Approved for Phase 3 task breakdown.

## Phase 3 Task Breakdown

These slices are ordered by the user value they unlock. Each user story is a vertical slice: shared contracts, backend work, API-client work, frontend UI, live wiring, and verification stay grouped under the story that needs them. Individual subtasks should still be implemented in dependency order within each slice, and each subtask is intended to fit in a focused implementation session and touch no more than about five files, excluding generated lockfile or route-tree updates when a tool necessarily changes them.

Prefer colocating new tests in the same folder as the code under test. Use a `__tests__` subfolder only when the source folder is getting too cluttered or when updating an existing test that already lives there. Use `*.integration.test.ts` or `*.integration.test.tsx` for tests that should run through `npx nx run <project>:test:integration`, and `*.e2e.test.ts` or `*.e2e.test.tsx` for tests that should run through `npx nx run <project>:test:e2e`.

### Story 1: Logs overview opens to the current day

As a calorie tracking person, I want to see a Logs overview screen opened to the current day, so that I can see what I've eaten today and what calorie budget is left.

- [x] Subtask: Generate the shared API client package foundation
  - Acceptance: `packages/api-client` exists as package `@calibrate/api-client`, follows workspace package conventions, exports from `src/index.ts`, depends on `@calibrate/api-contracts`, and is visible to Nx/workspaces. Run the generator as a dry run first and compare the generated shape against `packages/api-contracts`.
  - Verify: `npx nx show project @calibrate/api-client --json`
  - Files:
    - `packages/api-client/package.json`
    - `packages/api-client/src/index.ts`
    - `packages/api-client/tsconfig.json`
    - `package.json`
    - `package-lock.json`

- [x] Subtask: Add portable selected-day API access
  - Acceptance: `@calibrate/api-client` exposes a small `ApiTransport` factory that accepts `baseUrl`, injected `fetch`, and auth/session options where needed. Selected day log fetch lives in a file-per-operation module that accepts `ApiTransport`, parses responses through shared schemas where practical, and has no React DOM, TanStack Router, browser global, React Native, or UI primitive dependency.
  - Verify: `npx nx run @calibrate/api-client:typecheck` if a target exists; otherwise `npx nx run web:typecheck`
  - Files:
    - `packages/api-client/src/transport.ts`
    - `packages/api-client/src/day-logs/get-day-log.ts`
    - `packages/api-client/src/errors.ts`
    - `packages/api-client/src/index.ts`

- [x] Subtask: Add React Query provider and selected-day query helpers
  - Acceptance: `@calibrate/api-client` declares `@tanstack/react-query` as peer and dev dependency, `web` declares it as an app dependency, the web app owns `QueryClientProvider`, devtools/provider wiring, and base API client configuration. The selected-day operation exports portable query options/hooks that accept an `ApiTransport` without owning platform provider setup. Before any package install during implementation, present the exact install command if the lockfile needs to change.
  - Verify: `npx nx run web:test:integration`, then `npx nx run web:typecheck`
  - Files:
    - `packages/api-client/package.json`
    - `packages/api-client/src/day-logs/get-day-log.ts`
    - `packages/api-client/src/index.ts`
    - `apps/web-frontend/package.json`
    - `apps/web-frontend/src/main.tsx`
    - `apps/web-frontend/src/router.tsx`
    - `apps/web-frontend/src/shared/api/api-client.ts`
    - `apps/web-frontend/src/shared/api/query-client.ts`

- [x] Subtask: Add selected-date routing and log-page render helpers
  - Acceptance: `/logs` validates selected-date URL search params through TanStack Router if URL search is used, defaults to the current day when no date is selected, and pure helpers normalize `DayLogResponse | null` into renderable empty/loaded state, compute daily and meal totals, calculate placeholder target progress, and provide contract-shaped fixtures for normal, empty, loading, and error UI tests.
  - Verify: `npx nx run web:test -- src/pages/logs/log-page-helpers.test.ts`, then `npx nx run web:test:integration`
  - Files:
    - `apps/web-frontend/src/routes/logs.tsx`
    - `apps/web-frontend/src/pages/logs/log-page-helpers.ts`
    - `apps/web-frontend/src/pages/logs/log-page-fixtures.ts`
    - `apps/web-frontend/src/pages/logs/log-page-helpers.test.ts`
    - `apps/web-frontend/src/pages/logs/logs-routing.integration.test.tsx`
    - `apps/web-frontend/src/routeTree.gen.ts`

- [x] Subtask: Build the daily log mobile-first overview with mock data
  - Acceptance: `/logs` renders date stepper opened to today, daily progress summary, calorie budget remaining, weight summary/empty state, meal sections in Breakfast/Lunch/Dinner/Snacks order, empty meal states, meal add actions, and a FAB bottom sheet shell using contract-shaped fixture data and existing UI primitives first.
  - Before implementation: ask the user for screenshots of the current `/logs` page and any nearby app screens that establish mobile layout, spacing, typography, navigation, empty states, and larger-viewport behavior. Explain that this task builds the daily overview shell, not live data wiring.
  - Verify: `npx nx run web:test -- src/pages/logs/Logs.test.tsx`
  - Files:
    - `apps/web-frontend/src/pages/logs/Logs.tsx`
    - `apps/web-frontend/src/pages/logs/components/DateStepper.tsx`
    - `apps/web-frontend/src/pages/logs/components/DailySummary.tsx`
    - `apps/web-frontend/src/pages/logs/components/MealSection.tsx`
    - `apps/web-frontend/src/pages/logs/components/QuickLogDrawer.tsx`

- [x] Subtask: Wire selected-day live fetch into the overview
  - Acceptance: `/logs` loads the selected day through the package-owned `@calibrate/api-client` selected-day query hook/options, passing the web app's configured `ApiTransport`. The page renders empty state when the API returns `null`, shows loading and error states, preserves the mock-state visual structure when live data is connected, and updates totals when selected day data changes. Do not add a web-local data-fetching hook for this operation.
  - Verify: `npx nx run web:test:integration`
  - Files:
    - `packages/api-client/src/day-logs/get-day-log.ts`
    - `apps/web-frontend/src/pages/logs/Logs.tsx`
    - `apps/web-frontend/src/pages/logs/logs-live-day-log.integration.test.tsx`
    - `apps/web-frontend/src/shared/api/api-client.ts`

### Story 2: Update weight in a single day's log

As a calorie tracking person, I want to update my weight in a single day's log, so that I can track my progress each day.

- [ ] Subtask: Add shared weight update contract
  - Acceptance: `PATCH /daylogs/:date/weight` has Zod request/response schemas and exported TypeScript types, and the response shape returns the updated `DayLogResponse`.
  - Verify: `npx nx run backend:typecheck`
  - Suggested files:
    - `packages/api-contracts/src/day-log-requests.ts`
    - `packages/api-contracts/src/day-log-responses.ts`
    - `packages/api-contracts/src/index.ts`

- [ ] Subtask: Add day-log weight behavior to the domain and service layer
  - Acceptance: `DayLog` owns weight mutation through an explicit behavior method, the application DTOs include an update-weight request, and `IDayLogService.updateWeight({ userId, date, weight })` returns the updated `DayLog`. Service tests cover successful update, missing user, empty selected day creation, and validation of the aggregate behavior.
  - Verify: `npx nx run backend:test -- src/domain/entities/__tests__/day-log.test.ts src/application/services/__tests__/day-log-service.test.ts`
  - Suggested files:
    - `apps/backend/src/domain/entities/day-log.ts`
    - `apps/backend/src/domain/entities/__tests__/day-log.test.ts`
    - `apps/backend/src/application/dtos/day-log-dtos.ts`
    - `apps/backend/src/application/services/day-log-service.ts`
    - `apps/backend/src/application/services/__tests__/day-log-service.test.ts`

- [ ] Subtask: Persist weight updates and fix day-log find-or-create
  - Acceptance: `IDayLogRepository` exposes a targeted `updateWeight(dayLogId, weight)` write, `PostgresDayLogRepository.findOrCreateByDateAndUserId()` creates the requested dated row when none exists, and weight updates persist against the authenticated user's selected day log without bypassing the aggregate boundary.
  - Verify: `npx nx run backend:test:integration`, then `npx nx run backend:typecheck`
  - Suggested files:
    - `apps/backend/src/application/ports/day-log-repository.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-day-log-repository.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-day-log-repository.integration.test.ts`

- [ ] Subtask: Expose the day-log weight HTTP endpoint
  - Acceptance: `PATCH /daylogs/:date/weight` validates route params and body with shared schemas, requires authentication, calls `DayLogService.updateWeight`, and returns the updated `DayLogResponse`. Controller tests cover success, validation failure, unauthenticated access, and service error handling.
  - Verify: `npx nx run backend:test -- src/presentation/controllers/__tests__/day-log-controller.test.ts`, then `npx nx run backend:test:integration`
  - Suggested files:
    - `apps/backend/src/presentation/controllers/day-log-controller.ts`
    - `apps/backend/src/presentation/controllers/__tests__/day-log-controller.test.ts`
    - `apps/backend/src/presentation/controllers/day-log-controller.integration.test.ts`
    - `apps/backend/src/presentation/routes/day-log-routes.ts`
    - `apps/backend/src/presentation/mappers/day-log-response-mapper.ts`

- [ ] Subtask: Add portable weight update client and mutation helpers
  - Acceptance: `@calibrate/api-client` exposes a weight update operation and package-owned portable mutation options/hooks that accept an `ApiTransport`. The web app uses those exported package helpers to optimistically update the selected day's weight, roll back on mutation failure, show an error state, and invalidate/refetch the selected day log after success. Do not add `apps/web-frontend/src/pages/logs/use-update-weight.ts`.
  - Verify: `npx nx run web:test:integration`, then `npx nx run web:typecheck`
  - Suggested files:
    - `packages/api-client/src/day-logs/update-weight.ts`
    - `packages/api-client/src/index.ts`
    - `apps/web-frontend/src/pages/logs/logs-live-day-log.integration.test.tsx`
    - `apps/web-frontend/src/pages/logs/Logs.tsx`

### Story 3: Browse recent foods from the food search page

As a user, I want to see a food search page, so that I can browse foods I logged recently and start searching for another food to add.

- [ ] Subtask: Add shared recent-food contracts
  - Acceptance: `GET /foods/recent` has shared Zod request/response schemas and exported TypeScript types. The endpoint returns authenticated-user food entries used in the last three calendar days, ordered most recently used first, with each result containing food name, calories, serving size, and optional brand name plus the data needed to begin the confirmation flow.
  - Verify: `npx nx run backend:typecheck`
  - Suggested files:
    - `packages/api-contracts/src/recent-food-requests.ts`
    - `packages/api-contracts/src/recent-food-responses.ts`
    - `packages/api-contracts/src/index.ts`

- [ ] Subtask: Add the three-day recent-food query and HTTP endpoint
  - Acceptance: The application layer owns a recent-food read port/query handler, and the persistence adapter reads only the authenticated user's entries from the last three calendar days. `GET /foods/recent` requires authentication, returns the contract-shaped list in most-recent-first order, and handles repository failures without exposing persistence details. Tests cover no recent entries, the three-day boundary, user isolation, ordering, and optional brand data.
  - Verify: `npx nx run backend:test -- src/application/services/recent-food-service.test.ts`, then `npx nx run backend:test:integration`
  - Suggested files:
    - `apps/backend/src/application/dtos/recent-food-dtos.ts`
    - `apps/backend/src/application/ports/recent-food-query.ts`
    - `apps/backend/src/application/services/recent-food-service.ts`
    - `apps/backend/src/application/services/recent-food-service.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-recent-food-query.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-recent-food-query.integration.test.ts`
    - `apps/backend/src/presentation/controllers/recent-food-controller.ts`
    - `apps/backend/src/presentation/routes/recent-food-routes.ts`

- [ ] Subtask: Add portable recent-food client helpers
  - Acceptance: `@calibrate/api-client` exposes a `GET /foods/recent` operation and portable query options/hooks that accept an `ApiTransport`, parse responses through the shared schemas where practical, and contain no web-specific UI dependencies.
  - Verify: `npx nx run @calibrate/api-client:typecheck` if a target exists; otherwise `npx nx run web:typecheck`
  - Suggested files:
    - `packages/api-client/src/foods/get-recent-foods.ts`
    - `packages/api-client/src/index.ts`

- [ ] Subtask: Build the food search page against mock recent-food results
  - Acceptance: The page has a search bar at the top and displays mock recent-food results below it. Each result is a tappable card with food name, calories, serving size, and brand only when available; loading, empty, and error states are represented. Selecting a card carries the selected food into the confirmation-route state contract owned by Story 5.
  - Before implementation: ask the user for screenshots of existing search, list/card, page transition, loading, empty, and error UI patterns. Explain that this task builds the food-search-page shell and recent-result cards with mock data before live wiring.
  - Verify: `npx nx run web:test -- src/pages/logs/food-search.test.tsx`, then `npx nx run web:test:integration`
  - Suggested files:
    - `apps/web-frontend/src/pages/logs/components/FoodSearchPage.tsx`
    - `apps/web-frontend/src/pages/logs/components/FoodResultCard.tsx`
    - `apps/web-frontend/src/pages/logs/food-search.test.tsx`
    - `apps/web-frontend/src/pages/logs/food-search.integration.test.tsx`

- [ ] Subtask: Wire the food search page to recent foods
  - Acceptance: Entering the page fetches `GET /foods/recent` through the package-owned client query helper and renders the server-provided order. The search bar remains available for Story 4's typed-search behavior, and choosing a recent result opens the confirmation route once Story 5's route shell is available.
  - Verify: `npx nx run web:test:integration`, then `npx nx run web:typecheck`
  - Suggested files:
    - `packages/api-client/src/foods/get-recent-foods.ts`
    - `apps/web-frontend/src/pages/logs/components/FoodSearchPage.tsx`
    - `apps/web-frontend/src/pages/logs/food-search-live.integration.test.tsx`
    - `apps/web-frontend/src/pages/logs/food-confirmation-state.ts`

### Story 4: Search the shared food catalog to add a food

As a calorie tracking person, I want to be able to type to search for foods to add to the day, so that I can quickly add food entry logs in my busy day.

- [ ] Subtask: Add food-catalog schema, provenance, and staged-search contracts
  - Acceptance: A `food_catalog` migration and Kysely schema hold reusable food name, optional brand, serving and nutrition fields, source/provider identity, optional normalized GTIN barcode, provenance/verification state, normalized `search_text`, weighted `search_vector`, popularity, and timestamps. `food_entries` retain their immutable nutrition/serving snapshot and gain only an optional catalog provenance reference. `GET /foods/search?query=<text>&cursor=<cursor>` has Zod schemas with a trimmed 3-character minimum, bounded query length/token count, result limit, and opaque cursor. Its result shape distinguishes a private recent-entry result (including last-used metadata) from a catalog result; a FoodData Central fallback is mapped/upserted and returned as a catalog result rather than exposing provider payloads.
  - Verify: `npx nx run backend:typecheck`
  - Suggested files:
    - `apps/backend/src/infrastructure/persistence/migrations/<timestamp>_create_food_catalog.ts`
    - `apps/backend/src/infrastructure/persistence/schemas/food-catalog-table.ts`
    - `apps/backend/src/infrastructure/persistence/schemas/food-entries-table.ts`
    - `apps/backend/src/infrastructure/persistence/database-client.ts`
    - `packages/api-contracts/src/food-search-requests.ts`
    - `packages/api-contracts/src/food-search-responses.ts`
    - `packages/api-contracts/src/index.ts`

- [ ] Subtask: Add the guarded FoodData Central zero-hit fallback and catalog ingestion
  - Acceptance: A provider adapter maps trusted FoodData Central records into catalog inputs and upserts them by stable `(source, source_food_id)` identity. Configuration reads `FOODDATA_CENTRAL_API_KEY` once at startup through `dotenvx.get`; it is not exposed in API responses or logs. The adapter is called only after both local catalog and two-week recent queries return no match, uses a strict timeout and bounded result size, coalesces concurrent identical normalized queries, and caches both normalized-query results and no-result outcomes briefly. Future barcode ingestion validates and normalizes GTIN/check digits before a provider-verified catalog upsert; manually created foods remain user-private.
  - Implementation note: Reference the temporarily committed FoodData Central OpenAPI spec at `references/fdc_api.yaml` for provider request/response details.
  - Verify: `npx nx run backend:test -- src/infrastructure/food-data-central/food-catalog-importer.test.ts`
  - Suggested files:
    - `apps/backend/src/application/ports/food-catalog-writer.ts`
    - `apps/backend/src/infrastructure/food-data-central/food-data-central-catalog-importer.ts`
    - `apps/backend/src/infrastructure/food-data-central/food-data-central-mappers.ts`
    - `apps/backend/src/infrastructure/food-data-central/food-catalog-importer.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-food-catalog-writer.ts`
    - `apps/backend/src/infrastructure/index.ts`

- [ ] Subtask: Implement indexed local catalog and two-week recent search
  - Acceptance: The migration enables `pg_trgm`; creates a GIN index over the weighted `simple`-dictionary `search_vector`; creates a GIN `gin_trgm_ops` index over normalized `search_text`; and adds unique provider and barcode constraints where values exist. Catalog search uses parameterized, validated all-token full-text matching with safe prefix-token typeahead, handles name/brand tokens in either order, ranks exact/prefix name matches ahead of full-text rank, and uses trigram similarity only as a fuzzy fallback/ranking signal. In parallel, a private recent-query reads matching entries from only the authenticated user's prior two weeks. The service combines local results with recent entries first, dedupes catalog-linked duplicates while retaining meaningful user-specific serving variants, and returns a stable, cursor-paginated maximum page without table scans for ordinary queries.
  - Verify: `npx nx run backend:test -- src/infrastructure/persistence/repositories/postgres-food-catalog-search-query.test.ts`, then `npx nx run backend:test:integration`
  - Suggested files:
    - `apps/backend/src/application/ports/food-catalog-search-query.ts`
    - `apps/backend/src/application/ports/recent-food-query.ts`
    - `apps/backend/src/application/services/food-catalog-search-service.ts`
    - `apps/backend/src/application/services/food-catalog-search-service.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-food-catalog-search-query.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-food-catalog-search-query.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-food-catalog-search-query.integration.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-recent-food-query.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/postgres-recent-food-query.integration.test.ts`
    - `apps/backend/src/infrastructure/persistence/repositories/index.ts`

- [ ] Subtask: Expose the protected staged-search endpoint
  - Acceptance: `GET /foods/search` is authenticated, validates query params with the shared schema, runs catalog and authenticated two-week recent queries in parallel, returns their stable combined order/cursor when either hits, and invokes the bounded FoodData Central fallback only for a zero-local-hit result. It maps failures to safe HTTP responses and uses the existing/general request limit without changing rate-limit policy. Endpoint performance instrumentation and measurement, plus any decision on a broader local-catalog Redis cache, are deferred to a later separately scoped decision.
  - Verify: `npx nx run backend:test -- src/presentation/controllers/food-search-controller.test.ts`, then `npx nx run backend:test:integration`
  - Suggested files:
    - `apps/backend/src/presentation/controllers/food-search-controller.ts`
    - `apps/backend/src/presentation/controllers/food-search-controller.test.ts`
    - `apps/backend/src/presentation/controllers/food-search-controller.integration.test.ts`
    - `apps/backend/src/presentation/routes/food-search-routes.ts`
    - `apps/backend/src/presentation/routes/index.ts`
    - `apps/backend/src/infrastructure/container.ts`

- [ ] Subtask: Add portable food search client helpers
  - Acceptance: `@calibrate/api-client` exposes cursor-aware staged-search operations and portable query options/hooks that accept an `ApiTransport`, parse responses through shared schemas where practical, enforce the shared query contract, cancel superseded requests, and avoid client-side re-ranking.
  - Verify: `npx nx run @calibrate/api-client:typecheck` if a target exists; otherwise `npx nx run web:typecheck`
  - Suggested files:
    - `packages/api-client/src/foods/search-foods.ts`
    - `packages/api-client/src/index.ts`

- [ ] Subtask: Build food search UI against mock results
  - Acceptance: Search can open from the FAB or a meal section, meal-specific add actions preselect the meal, results render in backend-provided order without client re-ranking, catalog result cards show name, optional brand, calories, and serving size, recent-entry cards include compact last-used metadata, and loading/empty/error states are represented before live APIs are wired.
  - Before implementation: ask the user for screenshots of any existing search, list, bottom-sheet/page transition, loading, empty, and error UI patterns. Explain that this task builds the mock food-search experience and result rows before live API wiring.
  - Verify: `npx nx run web:test -- src/pages/logs/food-search.test.tsx`, then `npx nx run web:test:integration`
  - Suggested files:
    - `apps/web-frontend/src/pages/logs/components/FoodSearchPage.tsx`
    - `apps/web-frontend/src/pages/logs/components/FoodResultCard.tsx`
    - `apps/web-frontend/src/pages/logs/food-search.test.tsx`
    - `apps/web-frontend/src/pages/logs/food-search.integration.test.tsx`
    - `apps/web-frontend/src/pages/logs/Logs.tsx`

- [ ] Subtask: Wire live food search into the log flow
  - Acceptance: Food search calls `GET /foods/search` through the package-owned `@calibrate/api-client` staged-search query hook/options, passing the web app's configured `ApiTransport`. It debounces by roughly 250–350 ms, cancels superseded input requests, enforces the 3-character minimum, renders backend-ordered live results, preserves preselected meal context for Story 5's confirmation route, and keeps loading, empty, and error states stable. Do not add a web-local data-fetching hook or client-side result cache beyond the configured query cache for this operation.
  - Verify: `npx nx run web:test:integration`
  - Suggested files:
    - `packages/api-client/src/foods/search-foods.ts`
    - `apps/web-frontend/src/pages/logs/components/FoodSearchPage.tsx`
    - `apps/web-frontend/src/pages/logs/food-search-live.integration.test.tsx`
    - `apps/web-frontend/src/pages/logs/Logs.tsx`

### Story 5: Confirm and save a selected food entry

As a calorie-tracking person, I want to see a confirmation screen after pressing a food search result letting me change the serving unit, quantity, meal, see the nutrition info, and save my food entry, so that I can complete adding a food entry.

- [ ] Subtask: Add confirmation route shell and selected-food context
  - Acceptance: `/logs/confirm-food` exists as a hidden workflow route, search result selection carries selected food and preselected meal context into it, direct entry or refresh without selected-food context shows a recoverable empty state or returns the user to search, and search-to-confirmation navigation uses per-navigation `viewTransition: true` with normal navigation fallback.
  - Verify: `npx nx run web:test:integration`
  - Files:
    - `apps/web-frontend/src/routes/logs/confirm-food.tsx`
    - `apps/web-frontend/src/pages/logs/ConfirmFood.tsx`
    - `apps/web-frontend/src/pages/logs/food-confirmation-state.ts`
    - `apps/web-frontend/src/pages/logs/logs-routing.integration.test.tsx`
    - `apps/web-frontend/src/routeTree.gen.ts`

- [ ] Subtask: Build confirmation page UI against mock selected-food state
  - Acceptance: The confirmation page shows selected food details and nutrition info, allows quantity, serving unit, and meal edits, excludes direct calorie editing, handles missing/stale selected-food state safely, and keeps the route hidden from header/drawer navigation.
    Quantity should be a text field, while serving unit is a dropdown of accepted options
  - Before implementation: ask the user for screenshots of any existing form, select/input, detail, save/cancel, and error-state patterns. Explain that this task builds the hidden food-confirmation route UI, including quantity, serving unit, meal selection, nutrition display, and missing-context handling.
  - Verify: `npx nx run web:test -- src/pages/logs/ConfirmFood.test.tsx`
  - Files:
    - `apps/web-frontend/src/pages/logs/ConfirmFood.tsx`
    - `apps/web-frontend/src/pages/logs/components/ConfirmFoodForm.tsx`
    - `apps/web-frontend/src/pages/logs/components/ServingUnitSelect.tsx`
    - `apps/web-frontend/src/pages/logs/ConfirmFood.test.tsx`

- [ ] Subtask: Add portable save-food-entry client helpers
  - Acceptance: `@calibrate/api-client` exposes a save food entry operation and portable mutation options/hooks that accept an `ApiTransport`, send `POST /daylogs/:date/food-entries`, parse the updated selected-day response through shared schemas where practical, and support invalidating/refetching the selected day log after success.
  - Verify: `npx nx run @calibrate/api-client:typecheck` if a target exists; otherwise `npx nx run web:typecheck`
  - Files:
    - `packages/api-client/src/day-logs/save-food-entry.ts`
    - `packages/api-client/src/day-logs/get-day-log.ts`
    - `packages/api-client/src/index.ts`

- [ ] Subtask: Wire confirmed food save flow
  - Acceptance: The confirmation page saves through `POST /daylogs/:date/food-entries` using the package-owned `@calibrate/api-client` save-food-entry mutation hook/options, passing the web app's configured `ApiTransport`. It preserves the selected meal unless changed by the user, invalidates/refetches the selected day log after success, navigates back to `/logs`, surfaces save errors without losing the user's confirmation edits, and updates overview totals after the save. Do not add a web-local data-fetching hook for this operation.
  - Verify: `npx nx run web:test:integration`, then `npx nx run web:test:e2e`
  - Files:
    - `packages/api-client/src/day-logs/save-food-entry.ts`
    - `apps/web-frontend/src/pages/logs/ConfirmFood.tsx`
    - `apps/web-frontend/src/pages/logs/food-confirmation-state.ts`
    - `apps/web-frontend/src/pages/logs/confirm-food-live.integration.test.tsx`
    - `apps/web-frontend/src/pages/logs/confirm-food-save.e2e.test.tsx`
    - `apps/web-frontend/src/pages/logs/log-page-helpers.ts`

### Final Phase 3 Quality Gate

- [ ] Subtask: Run targeted quality gates and manual smoke verification
  - Acceptance: Backend and frontend targeted tests pass for touched areas, type-aware checks pass for touched projects, backend and frontend dev servers can run together, and the manual smoke path covers previous/next day navigation, empty day display, weight logging, food search, recent food display, confirmation edits, save, and totals update.
  - Verify: `npx nx run backend:test`, `npx nx run backend:test:integration`, `npx nx run backend:test:e2e`, `npx nx run backend:typecheck`, `npx nx run web:test`, `npx nx run web:test:integration`, `npx nx run web:test:e2e`, `npx nx run web:typecheck`, then `npx nx run backend:dev` and `npx nx run web:dev` for manual smoke when ready.
  - Files:
    - `docs/tasks/log-page/PLAN.md`
    - `docs/tasks/log-page/PRD.md`

## Phase 3 Review Gate

- [ ] Task breakdown reviewed.
- [ ] Task order approved.
- [ ] Verification commands approved for implementation sessions.
- [ ] Approved for Phase 4 implementation.
