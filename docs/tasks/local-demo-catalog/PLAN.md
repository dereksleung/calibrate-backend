# Implementation Plan: Self-contained local demo catalog

## Status

Specification and ticket breakdown published; tickets are ready for implementation.

## Goal

Let an evaluator run Calibrate from a fresh clone using Docker and generated local-only configuration, enter through the loopback local test session, search the Demo catalog, add a Food Entry, and see the updated Day Log and dashboard without private keys or provider calls.

## Confirmed decisions

- Docker runs PostgreSQL; the host does not need PostgreSQL installed.
- `demo-setup` is idempotent and persists local database state; `demo-reset` explicitly recreates that state while preserving local configuration.
- `demo-dev` starts frontend and backend together after setup.
- Demo configuration is generated into a gitignored local file, uses fresh non-production cryptographic values, and is never decrypted from normal Dotenvx configuration.
- The Demo catalog contains every importable record from a pinned Foundation Foods archive committed to the repository, with source metadata and SHA-256 checks. SR Legacy is deferred until its exact expanded JSON import has a measured acceptable memory and setup-time budget.
- Demo food search is local-only and returns an ordinary empty result when no catalog or recent-food match exists.
- The seed scans every Foundation Food's valid USDA portions. It retains at most one named non-volume measure, one mass value, and one allowlisted volume measure after normalizing them to the same Reference serving. It prefers the named non-volume measure as the primary reference, otherwise a volume measure, and falls back to 100 g. It does not infer units from `modifier` or `portionDescription`.
- The existing loopback local test-session path is the evaluator authentication flow.
- A source-reported zero is imported as zero. An Unreported nutrient is also represented as zero for the current numeric contract and is reported by food ID, name, and missing nutrient names.
- Each seed run writes `.demo/catalog-seed-report.json` with source release/checksum, imported counts, record-local mapping errors, and Unreported nutrients; setup prints its path and summary.
- Archive checksum, archive readability, and the top-level source envelope are source-wide gates. A record-local mapper error skips and reports that record rather than aborting the full import.
- A committed source manifest records each archive checksum, total-record count, expected importable-record count, and expected gap/error counts; setup fails when the observed summary differs.
- After preflight succeeds, the seed writes bounded 250-row upsert statements inside one outer transaction. It does not request returned rows during bulk seeding.

## Deferred

- Evaluate SR Legacy only after benchmarking the exact pinned archive's expanded-JSON memory use, setup duration, and resulting database size.

## Planned work

1. Create the shared local-runtime configuration generator and use it from E2E and demo tooling.
2. Add explicit demo runtime selection that bypasses Dotenvx, disables external food lookup and real email delivery, and preserves loopback-only behavior.
3. Add pinned USDA source archives, checksum metadata, and validated full-download mappers.
4. Add an idempotent backend Demo catalog seed target and a generated missing-nutrient report.
5. Add `demo-setup`, `demo-dev`, and `demo-reset` workspace targets.
6. Document the evaluator workflow and Docker prerequisite in the README.
7. Add focused mapper, seed, setup, and browser-flow checks.

## Verification contract

- Mapper tests cover valid USDA portions, the 100 g fallback, source-reported zero, Unreported nutrients, record-local mapping errors, and source-manifest mismatches.
- A PostgreSQL integration test proves the seed is idempotent and that a failed batch rolls back all catalog writes in the outer transaction.
- Workspace/demo-tool tests prove demo setup generates local configuration without `.env.keys`.
- A browser E2E smoke flow runs in demo mode: start a local test session, search a known Foundation Food, select and scale it, save it, and observe the Day Log update.

## README contract

Add an evaluator-facing `Run the local demo` section that names Node and Docker Desktop as prerequisites; gives the dependency-installation, `demo-setup`, and `demo-dev` commands; explains `demo-reset`; identifies the pinned Foundation Foods release; and states that demo mode does not make FoodData Central requests or send real email.
