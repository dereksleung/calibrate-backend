# 01: Generate shared local runtime configuration

**What to build:** Provide one development-only source of fresh, non-production runtime configuration for local demo setup and browser E2E execution. Keep networking bindings separate from cryptographic configuration, and preserve the existing E2E lifecycle.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] Local demo setup can generate the Ed25519 and HMAC material required for a fresh clone without reading normal encrypted configuration or a `.env.keys` file.
- [ ] Browser E2E execution uses the same local-runtime configuration generator while retaining isolated, disposable test environments.
- [ ] Generated configuration is clearly non-production, unique per local environment, and excluded from version control.
- [ ] Development port and origin bindings remain a separate responsibility from local cryptographic configuration.
- [ ] Focused tests prove generated configuration is usable by both consumers and does not require private Dotenvx material.
