# 03: Run the backend in local demo mode

**What to build:** Add an explicit loopback-only backend demo mode that runs on generated local configuration, serves the Demo catalog without FoodData Central, suppresses real email, and preserves the local test-session entry path.

**Blocked by:** 01: Generate shared local runtime configuration.

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] Demo mode is an explicit, loopback-only runtime selection rather than an implicit fallback in normal development or deployment.
- [ ] In demo mode, the backend reads generated process configuration and never decrypts or requires normal Dotenvx configuration or `.env.keys`.
- [ ] Demo food search reads the local Demo catalog and returns an ordinary empty result when neither catalog nor recent-food matches exist; it never calls FoodData Central.
- [ ] Demo mode never dispatches real email, while the loopback local test-session route remains available for evaluator entry.
- [ ] Normal development and deployed runtime behavior retain their existing configuration, provider lookup, and email behavior.
- [ ] Runtime tests prove demo isolation, no provider/email effects, generated-configuration use, and the preserved loopback guard.
