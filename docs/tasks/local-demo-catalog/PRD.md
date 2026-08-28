# Spec: Self-contained local Demo catalog

Status for Matt Pocock skills: ready-for-agent

## Problem Statement

An evaluator cannot currently run Calibrate from a fresh clone without private Dotenvx configuration, `.env.keys`, and a FoodData Central API key. The normal food-search fallback consequently makes the core food-logging experience unavailable to someone evaluating the repository. The project needs a fast, self-contained local demo that exercises real persistence, authenticated behavior, food search, nutrition scaling, and Day Log updates without exposing or recreating private credentials.

## Solution

Provide an explicit, loopback-only local demo mode. An evaluator installs ordinary project dependencies, runs Docker-backed demo setup, then starts the frontend and backend together. Setup generates fresh local-only runtime configuration, creates or reuses a local PostgreSQL database, applies migrations, validates and seeds a pinned USDA Foundation Foods Demo catalog, and reports source-data quality.

The evaluator enters through the existing local test-session flow, searches the local Demo catalog, selects a food, adjusts its Reference serving, saves a Food Entry, and sees the resulting Day Log and dashboard updates. Demo mode is deterministic after clone: it never decrypts normal Dotenvx configuration, calls FoodData Central, or sends real email.

## User Stories

1. As a hiring manager, I want to start Calibrate from a fresh clone without receiving private keys, so that I can evaluate the project safely and independently.
2. As a hiring manager, I want Docker to provide PostgreSQL, so that I do not need to install, configure, or version a database server myself.
3. As a hiring manager, I want one setup command to prepare the local demo, so that I can reach the product quickly.
4. As a hiring manager, I want one development command to start both application surfaces after setup, so that I do not need to discover backend and frontend command coordination.
5. As a hiring manager, I want to enter through a local test session rather than committed credentials, so that the authenticated product path is demonstrable without unsafe fixture accounts.
6. As a hiring manager, I want food search to work without a FoodData Central API key, so that the demo does not fail on private external configuration.
7. As a hiring manager, I want the Demo catalog to contain real USDA Foundation Foods reference data, so that the food-search and nutrition flow is meaningful rather than mocked.
8. As a food logger, I want nutrition from a food with no household portion to be shown and scaled from 100 g, so that the reference basis is consistent and truthful.
9. As a food logger, I want an available USDA named serving, mass, and volume measure to remain mutually equivalent, so that switching units changes nutrition accurately.
10. As a food logger, I want the default Reference serving to use a natural named non-volume measure when available, so that food confirmation starts with a readable quantity such as a piece or serving.
11. As a food logger, I want a usable volume measure to be available when USDA directly supplies one, so that I can log an equivalent cup, tablespoon, or other verified volume.
12. As a food logger, I want nutrition to scale when I change the selected quantity, so that a smaller or larger amount produces corresponding calorie and macro values.
13. As a food logger, I want to save a selected food through the normal Day Log flow, so that the new Food Entry affects the real Day Log and dashboard behavior.
14. As a maintainer, I want generated demo credentials to be unique to each clone and excluded from version control, so that demo setup does not create a secret-sharing path.
15. As a maintainer, I want rerunning demo setup to preserve the working Demo catalog and local data, so that setup is safe and fast after its first run.
16. As a maintainer, I want an explicit reset command, so that I can intentionally recreate local demo database state without regenerating unrelated local configuration.
17. As a maintainer, I want the pinned USDA archive and its expected import summary validated before catalog writes, so that setup fails loudly on source corruption or a mapper regression.
18. As a maintainer, I want a seed report listing each Unreported nutrient and record-local mapping failure by food ID and name, so that data-quality exceptions are inspectable rather than hidden.
19. As a maintainer, I want source-reported zero nutrients to remain zero and Unreported nutrients to contribute zero in the current numeric contract, so that every importable food remains usable while data gaps remain visible.
20. As a maintainer, I want a failed seed to leave the prior Demo catalog intact, so that an interrupted setup never leaves a partially imported catalog presented as healthy.
21. As a future contributor, I want the demo behavior and its USDA release clearly documented, so that I understand its scope and do not reintroduce a private-key requirement accidentally.

## Implementation Decisions

- The feature is an explicit local demo runtime mode. It is loopback-only, reads generated process configuration instead of normal Dotenvx configuration, disables provider-backed food lookup, and never enables real email delivery.
- The Demo catalog is reference data, separate from user-owned Day Logs and Food Entries. It does not alter the Day Log aggregate write boundary: saving a Food Entry continues through the existing aggregate-root flow.
- Docker provides a persistent local PostgreSQL service. Demo setup is idempotent; demo reset is the explicit destructive operation that recreates database state but preserves generated local configuration.
- A shared development-only runtime-configuration module generates the Ed25519 and HMAC material needed by both demo setup and E2E execution. Port/origin derivation remains separate from secret generation.
- The backend retains ownership of PostgreSQL catalog persistence. Bulk seeding is a concrete infrastructure concern; it does not expand the application port solely for setup optimization.
- Demo setup uses a pinned, checksummed USDA Foundation Foods archive committed to the repository. A committed source manifest records the expected checksum, total source records, importable records, and expected data-quality counts.
- The seed scans and preflights every source record before database writes. Archive checksum, archive readability, source envelope, and source-manifest mismatches fail setup. A malformed individual record is skipped and reported rather than invalidating the full catalog.
- Foundation nutrient values use the USDA per-100-g basis. Foods without a valid usable source portion use a 100 g Reference serving and nutrition remains on that basis.
- The seed scans all valid portions for each food and retains at most one named non-volume measure, one mass quantity, and one allowlisted volume measure. Retained values are normalized to one shared Reference serving before storing nutrition.
- A named non-volume measure is preferred as the primary Reference serving. If none is available, an allowlisted volume measure is primary. The 100 g basis is the final fallback.
- A portion is usable only when USDA directly supplies a positive amount, positive gram weight, and a named measure. The importer never interprets opaque source modifiers or infers a unit from free-text portion descriptions.
- Nutrition is scaled from the USDA per-100-g source values to the selected Reference serving. Any retained named serving, gram weight, and volume quantity describe that same stored nutrition amount.
- A direct USDA measure is classified as a volume only through an explicit allowlist. No density or cross-unit conversion is inferred.
- A source-reported zero nutrient is stored as zero. An Unreported nutrient is also represented as zero for the current numeric catalog contract and is surfaced in the seed report with its food identity and missing nutrient names.
- After preflight succeeds, the seed uses bounded multi-row upsert statements of 250 rows inside one outer database transaction. The transaction is all-or-nothing and does not return inserted rows unnecessarily.
- Normal development and deployed behavior retain their existing private configuration and FoodData Central capability. Demo mode alone turns the zero-local-hit path into an ordinary empty result.
- The evaluator-facing documentation states prerequisites, setup/start/reset commands, the pinned dataset scope, and the intentional lack of FoodData Central lookup and real email delivery.

## Testing Decisions

- The highest behavioral seam is the local-demo browser flow: create a local test session, search a known Foundation food, select it, change its quantity or unit, save it, and observe the Day Log update. This verifies user-visible behavior rather than internal calls.
- Mapper tests cover per-100-g fallback, valid named-serving/mass/volume normalization, unsupported portions, source-reported zeros, Unreported nutrients, and record-local errors. These tests assert mapped catalog behavior and generated diagnostics, not mapper implementation steps.
- Seed integration tests use PostgreSQL to prove idempotence, source-manifest enforcement, and rollback of all writes when a bulk batch fails. Existing PostgreSQL repository integration tests are the nearby prior art.
- Workspace-tool tests cover generated demo configuration, absence of a `.env.keys` requirement, idempotent setup, and explicit reset behavior. Existing worktree-setup and E2E-runtime tests are the nearby prior art.
- Runtime tests prove demo mode reads generated process configuration, avoids provider calls and real email delivery, and preserves the loopback local test-session guard.
- Browser E2E tests reuse the existing disposable PostgreSQL and web-server orchestration where it can exercise demo mode without coupling tests to a developer's persistent local database.
- Tests should validate externally visible setup, catalog, and logging outcomes. They should not lock in private helper structure, query construction details, or incidental report ordering beyond documented deterministic behavior.

## Out of Scope

- SR Legacy import in the first Demo catalog release. It remains deferred until a benchmark of its exact expanded JSON import proves acceptable local memory use, setup duration, and database size.
- Branded-food, FNDDS, or other FoodData Central data types.
- A runtime network download, a public embedded FoodData Central key, or a request for an evaluator to obtain their own key.
- Replacing PostgreSQL with Turso, SQLite, Supabase, MongoDB, or another database technology.
- A general-purpose unit-conversion engine, density inference, or parsing source free text to invent household measures.
- Real email verification, email-provider configuration, or full passkey signup as part of evaluator onboarding.
- Changing production/deployed configuration or removing the normal FoodData Central fallback outside demo mode.
- Committing a database dump, user data, generated local configuration, or generated seed reports.

## Further Notes

- The Demo catalog deliberately favors deterministic local evaluation over comprehensive grocery-product coverage. Empty results outside Foundation Foods are expected demo behavior.
- The source archive, source manifest, and seed report together provide provenance and an auditable record of catalog data quality.
- ADR-0004 records the enduring rationale for the self-contained local demo mode; this specification defines the expected behavior needed to implement it.
