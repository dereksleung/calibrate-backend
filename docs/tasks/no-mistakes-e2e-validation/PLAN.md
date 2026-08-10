# Handoff Plan: no-mistakes Worktree Bootstrap + Nx E2E Validation

## Goal

Make no-mistakes reliably provision its isolated worktree and run targeted Nx E2E validation, including browser automation and disposable backend dependencies.

The focused E2E flow creates a new local-development-only user through the application, without sending an email.

Use `.no-mistakes.yaml` as the gate contract. Do not rely on an agent skill to select the test command.

## Key Decisions

- Use `commands.test` in `.no-mistakes.yaml` for bootstrap plus the E2E command.
- Keep `npm ci` out of the Nx target; it belongs in the gate bootstrap.
- Use Playwright for automated browser testing, not the Desktop Browser plugin or CDP.
- Use Playwright’s `webServer` array to start and health-check the frontend and backend processes.
- Use the frontend server URL as Playwright’s `baseURL`; use the backend URL only for readiness checks and backend-facing test setup when necessary.
- Keep disposable Postgres lifecycle and migrations in a small outer E2E wrapper; do not model Postgres as a Playwright web server.
- Provide the development-user creation flow only in an explicitly local/E2E runtime configuration; it must be unavailable in production.
- The flow creates a verified, usable account directly and must not invoke the email sender, enqueue email, or depend on an inbox.
- Set `auto_fix.test: 0` so test findings require human approval.
- Commit `.no-mistakes.yaml` to the default branch. no-mistakes reads `commands.*` only from that trusted branch.

## Phase 0: Discovery

### Task 1: Map current E2E prerequisites

**Description:** Inspect the existing Nx projects, backend runtime, migrations, Docker/Compose setup, test tooling, and current account-creation/email behavior before choosing the exact target shape.

**Acceptance criteria:**

- [ ] Identify the web and backend Nx project names and their relevant serve/start targets.
- [ ] Identify how a disposable Postgres instance can be started.
- [ ] Confirm whether Playwright is already installed.
- [ ] Identify the existing account-creation path and email-sending boundary.
- [ ] Decide how a local/E2E-only user-creation capability will be guarded from non-local environments.
- [ ] Decide whether `nx affected -t test:e2e` correctly captures backend changes; add explicit dependencies if it does not.

**Verification:**

- [ ] `npx nx show project <web-project> --json`
- [ ] `npx nx show project <backend-project> --json`
- [ ] Document the frontend command/URL, backend command/health URL, database configuration, and required environment variables.

**Dependencies:** None

## Phase 1: E2E Runtime

### Task 2: Add Playwright foundation and managed application servers

**Description:** Add Playwright configuration and a dedicated E2E project/target. Configure Playwright’s `webServer` array to launch the frontend and backend independently, each with an explicit readiness URL. Ask for approval before installing any package or browser binary.

**Acceptance criteria:**

- [ ] Playwright starts the frontend server and uses its URL as `baseURL`.
- [ ] Playwright starts the backend server and waits for its health/readiness endpoint.
- [ ] Server commands receive the isolated E2E database configuration and explicit local/E2E-only feature flag.
- [ ] CI does not reuse an existing process; local development may opt into `reuseExistingServer`.
- [ ] Screenshots/traces are retained on failures.
- [ ] The runner uses a test-only browser profile and test-only environment.

**Suggested configuration shape:**

```ts
export default defineConfig({
  webServer: [
    {
      name: 'frontend',
      command: 'npx nx run <web-project>:serve --port=<frontend-port>',
      url: 'http://127.0.0.1:<frontend-port>',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      name: 'backend',
      command: 'npx nx run <backend-project>:dev',
      url: 'http://127.0.0.1:<backend-port>/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:<frontend-port>',
  },
});
```

**Test plan:**

- [ ] Confirm a passing smoke test can load the local development user-creation route or entry point.
- [ ] Confirm a deliberate assertion failure produces a trace/screenshot.
- [ ] Confirm the entry point is unavailable when the local/E2E guard is absent.

**Verification:**

- [ ] `npx nx run <web-project>:test:e2e --outputStyle=static`

**Dependencies:** Task 1

### Task 3: Implement disposable database lifecycle

**Description:** Create a small E2E wrapper that starts isolated Postgres, waits for database health, applies migrations, invokes Playwright, and always tears down the database. Playwright owns frontend/backend process lifecycle through its `webServer` configuration.

**Acceptance criteria:**

- [ ] Uses an isolated database name/port; never points at a developer database.
- [ ] Exports the database connection and explicit local/E2E configuration to both Playwright-managed server commands.
- [ ] Uses a test email implementation or observation point that can prove no email is sent.
- [ ] Playwright waits for both frontend and backend before tests begin.
- [ ] Playwright shuts down frontend/backend processes after the test run.
- [ ] The wrapper tears down Postgres after pass, failure, or cancellation.
- [ ] Emits useful database and server logs on startup failure.

**Test plan:**

- [ ] Simulate a failing Playwright test and verify frontend, backend, and database cleanup.
- [ ] Simulate an unavailable database and verify a clear failure before Playwright starts the application servers.
- [ ] Verify the E2E runtime cannot use real email-delivery credentials or infrastructure.

**Verification:**

- [ ] Run the target twice consecutively without port, process, or container collisions.

**Dependencies:** Task 2

### Task 4: Add local-development user-creation E2E coverage

**Description:** Implement a focused browser E2E suite for creating a brand-new local-development-only user. The test must exercise the intended user-facing flow, prove the user is created and can enter the application, and prove the flow does not cause an email send.

**Acceptance criteria:**

- [ ] Creates a unique new user for each test run through the local-development-only UI flow.
- [ ] The created account is usable for the expected post-creation sign-in/session flow.
- [ ] No verification email, welcome email, queued email job, or email-sender invocation is produced by this flow.
- [ ] The local-development-only entry point is unavailable outside the explicit local/E2E configuration.
- [ ] The test does not use a real inbox, external email provider, or production credentials.

**Test plan:**

- [ ] Happy path: create a new local-development user and reach the authenticated application state.
- [ ] Email-suppression assertion: inspect the test email double, outbox, or sender spy and assert zero sends.
- [ ] Guard assertion: start without the local/E2E flag and assert the route or action is absent/denied.
- [ ] Duplicate or invalid input: confirm the flow returns a safe, clear error without sending email.

**Verification:**

- [ ] Run only the local-development user-creation Playwright project or grep locally.

**Dependencies:** Tasks 2–3

## Checkpoint: E2E Runtime

- [ ] E2E runner works from a clean checkout after `npm ci`.
- [ ] Playwright starts and stops both frontend and backend servers.
- [ ] The E2E wrapper creates, migrates, and cleans up only its disposable database.
- [ ] The local-development user flow creates a usable account without sending email.
- [ ] Failure artifacts are readable.
- [ ] Human reviews test scope, runtime cost, and the non-production guard.

## Phase 2: Gate Bootstrap

### Task 5: Add trusted no-mistakes test configuration

**Description:** Add a root `.no-mistakes.yaml` to the default branch.

Suggested initial configuration:

```yaml
commands:
  test: >
    npm ci --prefer-offline &&
    npx nx run <web-project>:test:e2e --outputStyle=static

auto_fix:
  test: 0
```

**Acceptance criteria:**

- [ ] `npm ci` executes inside the gate worktree before Nx runs.
- [ ] The E2E target is the explicit baseline for the test step.
- [ ] Test findings park for approval instead of auto-editing code.
- [ ] No frontend, backend, or database process outlives the E2E command.

**Verification:**

- [ ] `no-mistakes axi logs --step test --full` shows bootstrap, target execution, and exit result.
- [ ] A deliberate E2E failure creates a test gate rather than an automatic fix.

**Dependencies:** Tasks 2–4

### Task 6: Add agent guidance

**Description:** Update root `AGENTS.md` with the exact E2E target and local-development-user safety invariant.

**Acceptance criteria:**

- [ ] States the target command for relevant web/backend changes.
- [ ] States that Playwright’s `webServer` configuration owns frontend and backend process startup/readiness.
- [ ] States that the E2E wrapper owns only disposable database setup, migration, and teardown.
- [ ] States that the focused E2E flow creates a new local-development-only user without sending email.
- [ ] States that this capability must be explicitly enabled only for local/E2E runtime and must not be available in production.
- [ ] States that tests must assert email suppression through the configured test double, outbox, or sender spy.
- [ ] States that E2E dependencies must be provisioned by the gate bootstrap, not shared `node_modules`.

**Verification:**

- [ ] A fresh agent can identify the target, process ownership, local-only guard, and no-email assertion from repository instructions alone.

**Dependencies:** Task 5

## Initial Rollout Constraint

The first PR containing `.no-mistakes.yaml` will not use its own new `commands.test`: gate-control commands are read from the current trusted default branch. Validate that initial PR manually, or explicitly skip only its local test step with human approval. Once merged, later gate runs will bootstrap automatically.

## Risks

| Risk | Mitigation |
|---|---|
| `npm ci` makes every gate slow | Use npm’s download cache; never share `node_modules` between worktrees. |
| Browser binary unavailable | Provision/cache Playwright Chromium explicitly; obtain approval before installing it. |
| Frontend or backend server starts against the wrong database | Pass explicit isolated E2E connection settings through each `webServer.env`; fail closed when absent. |
| Development-only account creation becomes reachable in production | Enforce the guard server-side, default it off, and cover its absence with E2E/integration tests. |
| E2E accidentally sends real email | Use a test-only sender or outbox and assert zero sends; do not provide delivery credentials to the E2E runtime. |
| Backend changes do not mark web E2E as affected | Add explicit Nx task/project dependencies or use a deliberately scoped target. |
| E2E leaves processes or containers running | Let Playwright own application-process shutdown and use a database wrapper with cleanup on every exit path. |
| Test agent rewrites intentional local-only behavior | Keep `auto_fix.test: 0`; document the local-only and no-email invariants. |

## Final Acceptance Criteria

- [ ] A clean no-mistakes worktree runs `npm ci`, then the Nx E2E target.
- [ ] Playwright starts, waits for, and cleans up the frontend and backend servers.
- [ ] The target provisions, migrates, and cleans up its own disposable database.
- [ ] The E2E test creates a new local-development-only user through the application.
- [ ] The test proves that no email is sent or queued.
- [ ] The local-development-only flow is unavailable without its explicit local/E2E configuration and in production.
- [ ] Test failures park for human review.
- [ ] The gate produces usable test artifacts and does not require the Desktop Browser plugin.
