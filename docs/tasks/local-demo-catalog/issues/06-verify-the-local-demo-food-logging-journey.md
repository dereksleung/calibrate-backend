# 06: Verify the local demo food-logging journey

**What to build:** Prove the evaluator-visible Demo catalog experience in a real browser: establish the local test session, find and log a known Foundation Food, scale its Reference serving, and observe the updated Day Log.

**Blocked by:** 02: Seed the Foundation Foods Demo catalog; 05: Launch and document the evaluator demo.

**Status:** ready-for-agent

**Status for Matt Pocock skills:** ready-for-agent

- [ ] The browser E2E runtime gains an opt-in Demo catalog fixture, disabled by default so existing Playwright tests retain their minimal database setup.
- [ ] Enabling the fixture creates a disposable PostgreSQL environment, applies migrations, runs the shared Foundation Foods seeder, and starts the application in local demo mode.
- [ ] The browser flow enters through the loopback local test session and finds a known seeded Foundation Food without FoodData Central access.
- [ ] The flow selects the food, changes its quantity from the Reference serving, and observes nutrition values scaled to the selected amount.
- [ ] Saving the Food Entry updates the real Day Log with the selected food and adjusted nutrition.
- [ ] The test remains independent of a developer’s persistent Docker volume, private configuration, external provider network access, and real email delivery.
