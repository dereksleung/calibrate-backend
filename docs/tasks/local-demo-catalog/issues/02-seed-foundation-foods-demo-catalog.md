# 02: Seed the Foundation Foods Demo catalog

**What to build:** Add a reusable, idempotent Foundation Foods catalog seed capability backed by the pinned USDA source release. It validates provenance before writes, produces an auditable seed report, and retains truthful, mutually equivalent Reference serving measures for Demo catalog foods.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] The pinned Foundation Foods source and committed manifest establish its release identity, checksum, expected record counts, and expected data-quality totals.
- [ ] Preflight scans every source record and fails before writes when the archive, envelope, checksum, or expected aggregate summary is invalid.
- [ ] Each importable food preserves USDA per-100-g nutrition and selects a deterministic Reference serving: named non-volume measure first, then verified volume, then 100 g.
- [ ] When available, one named non-volume measure, one mass quantity, and one allowlisted volume quantity are retained only after normalization to the same food amount and nutrition basis.
- [ ] Source-reported zero nutrients remain zero; Unreported nutrients are represented as zero under the current numeric contract and are listed by food identity and nutrient in the generated report.
- [ ] A record-local mapping failure skips only that food and records its USDA identity, description, and error in the report.
- [ ] After successful preflight, writes use 250-row bounded upserts inside one outer transaction, making reruns idempotent and failed batches fully rollbackable.
- [ ] Mapper and PostgreSQL integration tests prove serving selection, diagnostics, manifest enforcement, idempotence, and transaction rollback.
