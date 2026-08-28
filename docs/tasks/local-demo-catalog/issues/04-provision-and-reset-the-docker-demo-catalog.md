# 04: Provision and reset the Docker Demo catalog

**What to build:** Give a fresh clone an idempotent Docker-backed setup command that generates safe local configuration, starts persistent PostgreSQL, applies migrations, seeds the Foundation Foods Demo catalog, and reports the result. Provide an explicit reset command for intentional database recreation.

**Blocked by:** 01: Generate shared local runtime configuration; 02: Seed the Foundation Foods Demo catalog; 03: Run the backend in local demo mode.

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] `demo-setup` creates or reuses safe local demo configuration, starts the Docker PostgreSQL service, applies migrations, and seeds the Demo catalog.
- [ ] Re-running `demo-setup` preserves existing local Demo database state and completes without duplicating catalog records.
- [ ] Setup prints a concise catalog result and the location of its generated data-quality report.
- [ ] `demo-reset` is the only explicit destructive command: it recreates Demo database state while preserving generated local configuration.
- [ ] Docker is the only required PostgreSQL runtime; setup does not require a host PostgreSQL installation.
- [ ] Focused workspace-tool coverage proves setup does not require `.env.keys`, is idempotent, and keeps reset behavior explicit.
