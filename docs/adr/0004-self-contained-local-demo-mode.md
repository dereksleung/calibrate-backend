# ADR-0004: Use a self-contained local demo mode with pinned USDA data

## Status

Accepted

## Date

2026-08-28

## Context

The normal local setup depends on private Dotenvx configuration and a FoodData Central API key. That prevents an evaluator from running Calibrate from a fresh clone. A remote shared database would solve one setup step but would make the evaluator experience dependent on shared credentials, availability, and mutable shared state.

## Decision

Provide an explicit, loopback-only local demo mode. It generates gitignored, local-only runtime configuration; starts PostgreSQL through Docker; preserves its local database across normal reruns; uses the existing local test-session path; does not send email, decrypt normal Dotenvx configuration, or call FoodData Central at runtime.

The Demo catalog is seeded idempotently from a pinned, checksummed USDA Foundation Foods source archive committed to the repository. The catalog is reference data, not a database dump or user fixture. The seed scans Foundation portions and retains at most one named non-volume measure, one mass value, and one volume measure after normalizing them to the same Reference serving; foods without a valid source portion use 100 g. Dataset upgrades are deliberate reviewed changes. SR Legacy is deferred until a benchmark of its expanded JSON import establishes an acceptable local memory and setup-time budget.

## Consequences

- Clone-and-run requires Docker rather than a host PostgreSQL installation, plus the ordinary dependency installation.
- `demo-reset` is an explicit destructive command that recreates only the local demo database state.
- Food search outside the Demo catalog returns an ordinary empty result in demo mode rather than requiring an API key.
- The configuration/key generator is shared by E2E and demo setup, but PostgreSQL catalog writing remains backend infrastructure.
- A source-reported zero remains zero. An Unreported nutrient is represented as zero for the existing numeric catalog contract and is listed by food ID, name, and nutrient in the generated seed report.
- Archive/envelope failures abort setup before catalog writes; record-local mapping failures are reported and skipped so one anomalous source record does not discard the whole catalog.
- After all records have passed preflight, catalog upserts use bounded multi-row statements inside one outer database transaction.
