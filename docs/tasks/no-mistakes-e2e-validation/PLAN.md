# Handoff Plan: no-mistakes Worktree Bootstrap + Nx E2E Validation

## Goal

Make no-mistakes reliably provision its isolated worktree and run targeted Nx E2E validation, including browser automation and disposable backend dependencies.

The focused E2E flow creates a new local-development-only user through the application, without sending an email.

Use `.no-mistakes.yaml` as the gate contract. Do not rely on an agent skill to select the test command.

## Key Decisions

- Use `commands.test` in `.no-mistakes.yaml` for bootstrap plus the E2E command.
- Keep `npm ci` out of the Nx target; it belongs in the gate bootstrap.
- Use Playwright for automated browser testing, not the Desktop Browser plugin or CDP.
- Create a standalone `web-e2e` Nx project, then configure it with the Nx Playwright generator. Configure the inferred inner Playwright target as `web-e2e:parameterize-playwright`; make `web-e2e:e2e` the normal, full E2E command that provisions disposable dependencies and invokes that inner target.
- Use Playwright’s `webServer` array to start and health-check the frontend and backend processes.
- Have `web-e2e:e2e` select an isolated frontend/backend port pair for each run and pass it into both Playwright-managed servers. Never use fixed `3000`/`3001` ports in the E2E runtime.
- Derive the frontend `baseURL`, frontend API base URL, backend CORS allowlist, and `WEBAUTHN_ORIGIN` from the selected localhost frontend port, so each worktree talks only to its own processes.
- The `web-e2e:e2e` wrapper builds one `e2eEnv` object and passes it as the child-process environment when it invokes `web-e2e:parameterize-playwright`; it does not write a generated dotenv file.
- `CALIBRATE_E2E=1` enables E2E-only configuration. In this mode, backend E2E values must read from `process.env` before dotenvx so a local `.env` cannot override the isolated database, ports, or no-op email mode.
- Keep disposable Postgres lifecycle and migrations in a small outer E2E wrapper using the repository’s existing Testcontainers dependency; do not model Postgres as a Playwright web server or reuse the fixed-port, persistent Compose database.
- The existing loopback-only development flow creates an enrollment authorization for a generated `@example.test` address, then creates the user only after the real passkey-registration ceremony.
- Use Playwright 1.61 or later's native `browserContext.credentials` virtual authenticator so the E2E suite can complete that ceremony without hardware or raw CDP.
- Add an explicit test-only no-op email-delivery mode that takes precedence over any `EMAIL_SERVICE_CREDENTIAL` loaded by `dotenvx`; the flow then cannot deliver email. The test must prove it never enters the email-verification flow, while allowing the existing passkey-notification call to be handled by the no-op sender.
- Default Playwright screenshots to `only-on-failure` for local development. Let the gate opt in to screenshots for successful tests with `CALIBRATE_E2E_CAPTURE_SCREENSHOTS=1`, so no-mistakes provides visual E2E evidence without making normal local runs artifact-heavy.
- Set `auto_fix.test: 0` so test findings require human approval.
- Commit `.no-mistakes.yaml` to the default branch. no-mistakes reads `commands.*` only from that trusted branch.

## Phase 0: Discovery

### Task 1: Map current E2E prerequisites

**Description:** Inspect the existing Nx projects, backend runtime, migrations, Docker/Compose setup, test tooling, and current account-creation/email behavior before choosing the exact target shape.

**Acceptance criteria:**

- [ ] Identify the web and backend Nx project names and their relevant serve/start targets.
- [ ] Identify the existing Testcontainers Postgres setup and why it is safer than the fixed-port, persistent Compose service for E2E.
- [ ] Confirm whether `@nx/playwright` and `@playwright/test` are already installed, including whether the available Playwright version supports `browserContext.credentials`.
- [ ] Identify the current `web:test:e2e` target as Vitest-based and separate it from the standalone `web-e2e:parameterize-playwright` target that the Nx plugin will infer.
- [ ] Identify the existing account-creation path and email-sending boundary.
- [ ] Record the existing server-side guard: non-production, matching HTTP loopback `WEBAUTHN_ORIGIN`, matching `Origin` header, and loopback client address.
- [ ] Decide how `web-e2e:e2e` will be selected for web and backend changes; the current project graph has no `web` ↔ `backend` dependency.

**Verification:**

- [ ] `npx nx show project web --json`
- [ ] `npx nx show project backend --json`
- [ ] Document the parameterized frontend/backend dev commands, their injected ports, derived `VITE_API_BASE_URL`, derived `WEBAUTHN_ORIGIN`, database, explicit no-op email mode, and required test-only environment variables.
- [ ] Document the exact test-only values required for backend startup: a fresh base64url `OTP_HMAC_KEY` of at least 32 bytes, a fresh hexadecimal `EMAIL_REQUEST_IP_HMAC_KEY` of at least 32 bytes, and `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_ACCESS_TOKEN_TTL_SECONDS`.

**Dependencies:** None

## Phase 1: E2E Runtime

### Task 2: Add Playwright foundation and managed application servers

**Description:** After approval, create the standalone `web-e2e` Nx project and use `@nx/playwright:configuration` to configure it. Configure the Nx Playwright plugin to infer its target as `web-e2e:parameterize-playwright`, then adapt the generated configuration to use a `webServer` array. Task 3 adds `web-e2e:e2e` as the supported full-flow target. Ask for approval before installing any package or browser binary.

**Acceptance criteria:**

- [ ] The generated Playwright configuration exposes an inferred `web-e2e:parameterize-playwright` target, while the `web` project retains ownership only of application targets.
- [ ] Playwright starts parameterized frontend and backend development targets, using the per-run ports selected by Task 3.
- [ ] Playwright uses the derived frontend URL as `baseURL` and waits for the derived backend health URL.
- [ ] The frontend server receives a derived `VITE_API_BASE_URL`; the backend inherits the isolated E2E database and derived WebAuthn/CORS environment from the `e2eEnv` child-process environment supplied by Task 3.
- [ ] `web-e2e:e2e` always sets `reuseExistingServer: false`, so it fails rather than silently using a server from another worktree.
- [ ] Screenshots/traces are retained on failures during ordinary E2E runs.
- [ ] `CALIBRATE_E2E_CAPTURE_SCREENSHOTS=1` changes screenshots to `on`, while the default remains `only-on-failure`.
- [ ] The runner uses a test-only browser profile and test-only environment.
- [ ] The selected Playwright version is 1.61 or later and the suite uses `browserContext.credentials` for virtual WebAuthn registration, not a CDP session.

**Suggested configuration shape:**

```ts
function requireE2ePort(name: "E2E_FRONTEND_PORT" | "E2E_BACKEND_PORT"): number {
  const port = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${name} must be an available unprivileged TCP port`);
  }
  return port;
}

const frontendPort = requireE2ePort("E2E_FRONTEND_PORT");
const backendPort = requireE2ePort("E2E_BACKEND_PORT");
const frontendUrl = `http://localhost:${frontendPort}`;
const backendUrl = `http://localhost:${backendPort}`;

export default defineConfig({
  webServer: [
    {
      name: 'frontend',
      command: `npx nx run web:e2e-dev --args="--port=${frontendPort}"`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: `${backendUrl}/api/v1`,
      },
    },
    {
      name: 'backend',
      command: `npx nx run backend:e2e-dev --args="--port=${backendPort}"`,
      url: `${backendUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: frontendUrl,
    screenshot:
      process.env.CALIBRATE_E2E_CAPTURE_SCREENSHOTS === "1"
        ? "on"
        : "only-on-failure",
    trace: "retain-on-failure",
  },
});
```

**Test plan:**

- [ ] Confirm the generated configuration lists tests without requiring an existing developer database.
- [ ] Confirm a deliberate assertion failure produces a trace/screenshot once Task 3 provides the database runtime.
- [ ] Confirm `CALIBRATE_E2E_CAPTURE_SCREENSHOTS=1` retains a screenshot after a successful test, while an unset variable retains screenshots only on failure.
- [ ] Confirm the configuration derives one matching localhost origin for the browser, backend CORS, and WebAuthn guard.

**Verification:**

- [ ] `npx nx run web-e2e:parameterize-playwright --outputStyle=static -- --list`

**Dependencies:** Task 1

### Task 3: Implement disposable database lifecycle

**Description:** Create `web-e2e:e2e`, the normal full E2E target. Its wrapper uses the existing Testcontainers Postgres pattern with a random mapped port, selects a distinct frontend/backend port pair, applies migrations, builds one child-process environment, invokes `web-e2e:parameterize-playwright`, and always tears down the database. The Playwright configuration owns frontend/backend process lifecycle through its `webServer` configuration.

**Acceptance criteria:**

- [ ] Uses a Testcontainers database with an isolated database name and random mapped port; never points at a developer database or Compose volume.
- [ ] Selects a unique `E2E_FRONTEND_PORT` / `E2E_BACKEND_PORT` pair before Playwright parses its configuration; retries selection/startup on a port collision.
- [ ] Builds `e2eEnv` with the isolated database connection, `CALIBRATE_E2E=1`, `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_ORIGIN=http://localhost:<E2E_FRONTEND_PORT>`, the corresponding CORS allowlist, and `VITE_API_BASE_URL=http://localhost:<E2E_BACKEND_PORT>/api/v1`; passes it only to the child process running `web-e2e:parameterize-playwright`.
- [ ] Does not write dynamic ports, database settings, test-only HMAC keys, or delivery settings to `.env`, `.env.local`, or any other shared dotenv file.
- [ ] Adds parameterized `web:e2e-dev` and `backend:e2e-dev` targets (or an equivalently explicit shared launcher) that accept the injected ports; it does not depend on fixed-port `web:dev` / `backend:dev` behavior.
- [ ] Adds an explicit E2E no-op email-delivery mode that overrides a credential loaded from `.env` by dotenvx when `process.env.CALIBRATE_E2E === "1"`, ensuring the backend selects `NoopEmailSender` and cannot contact Brevo.
- [ ] In E2E mode, gives the isolated `process.env` values precedence over dotenvx for all E2E-controlled backend configuration.
- [ ] Generates fresh test-only HMAC keys in the formats the backend parses, and supplies the JWT issuer, audience, and TTL required to construct the backend container.
- [ ] Playwright waits for both frontend and backend before tests begin.
- [ ] Playwright shuts down frontend/backend processes after the test run.
- [ ] The wrapper tears down Postgres after pass, failure, or cancellation.
- [ ] Emits useful database and server logs on startup failure.

**Port-selection implementation:**

```ts
async function selectPortPair(startPort = 3000): Promise<{ frontendPort: number; backendPort: number }> {
  for (let frontendPort = startPort; frontendPort <= 65_534; frontendPort += 2) {
    const backendPort = frontendPort + 1;
    if ((await canBindLocalhost(frontendPort)) && (await canBindLocalhost(backendPort))) {
      return { frontendPort, backendPort };
    }
  }
  throw new Error("No adjacent localhost port pair is available for E2E");
}
```

`canBindLocalhost` must briefly bind and close a Node `net.Server` on the exact localhost address the app servers use. Run the selector immediately before spawning `web-e2e:parameterize-playwright`. Because a probe cannot reserve a port after it closes, if either Playwright-managed server reports `EADDRINUSE`, tear down the attempt and retry the complete E2E run from the next even port pair.

```ts
const e2eEnv = {
  ...process.env,
  CALIBRATE_E2E: "1",
  E2E_FRONTEND_PORT: String(frontendPort),
  E2E_BACKEND_PORT: String(backendPort),
  WEBAUTHN_ORIGIN: `http://localhost:${frontendPort}`,
  VITE_API_BASE_URL: `http://localhost:${backendPort}/api/v1`,
  // isolated DB settings, fresh test-only HMAC keys, and no-op email mode
};

await runNx("web-e2e:parameterize-playwright", { env: e2eEnv });
```

**Test plan:**

- [ ] Simulate a failing Playwright test and verify frontend, backend, and database cleanup.
- [ ] Simulate an unavailable database and verify a clear failure before Playwright starts the application servers.
- [ ] Verify the E2E runtime fails closed if the required test-only HMAC keys or isolated database configuration are absent, and cannot inherit a real email-delivery sender when a local `.env` contains a credential.
- [ ] Start two `web-e2e:e2e` invocations concurrently from separate worktrees and verify that each selects a different port pair and reaches only its own frontend/backend processes.

**Verification:**

- [ ] Run `npx nx run web-e2e:e2e --outputStyle=static` twice consecutively and concurrently from separate worktrees without port, process, or container collisions.

**Dependencies:** Task 2

### Task 4: Add local-development user-creation E2E coverage

**Description:** Implement a focused browser E2E suite for the existing loopback-only local passkey signup. It must click the local authorization UI, use Playwright’s virtual authenticator to complete the real passkey ceremony, prove a new user is created and can enter the application, and prove the email-verification flow is not used.

**Acceptance criteria:**

- [ ] Creates a unique new user for each test run through the local-development-only UI flow.
- [ ] The created account is usable for the expected post-creation sign-in/session flow.
- [ ] Uses a generated `@example.test` email and completes the existing enrollment-authorization plus passkey-registration flow.
- [ ] Makes no request to `/auth/email-verification` or `/auth/email-verification/verify` and cannot deliver email because the explicit E2E mode selects `NoopEmailSender`.
- [ ] Does not assert zero email-sender method calls: the existing successful registration intentionally invokes its passkey-notification method, which the no-op sender absorbs.
- [ ] The local-development-only entry point remains protected by its existing non-production, matching-loopback-origin, matching-`Origin`, and loopback-client checks.
- [ ] The test does not use a real inbox, external email provider, or production credentials.

**Test plan:**

- [ ] Happy path: install Playwright’s virtual authenticator, authorize local signup, create the passkey, and reach the authenticated application state.
- [ ] Email-suppression assertion: observe browser requests and assert neither email-verification endpoint is called; assert the explicit E2E mode selects `NoopEmailSender` even if a local `.env` contains `EMAIL_SERVICE_CREDENTIAL`.
- [ ] Guard assertion: exercise the already-covered backend loopback/production guard at the integration level; keep the browser E2E on the permitted localhost path.
- [ ] Expired or consumed authorization: confirm the flow returns a safe, clear error without using the email-verification flow.

**Verification:**

- [ ] `npx nx run web-e2e:e2e --outputStyle=static -- --grep "local development passkey signup"`

**Dependencies:** Tasks 2–3

## Checkpoint: E2E Runtime

- [ ] E2E runner works from a clean checkout after `npm ci` and approved Playwright browser provisioning.
- [ ] Playwright starts and stops both frontend and backend servers.
- [ ] The E2E wrapper creates, migrates, and cleans up only its disposable database.
- [ ] The local-development user flow creates a usable account without using the email-verification flow or delivering email.
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
    CALIBRATE_E2E_CAPTURE_SCREENSHOTS=1
    npx nx run web-e2e:e2e --outputStyle=static

auto_fix:
  test: 0
```

**Acceptance criteria:**

- [ ] `npm ci` executes inside the gate worktree before Nx runs.
- [ ] `web-e2e:e2e` is the explicit baseline for the test step.
- [ ] The gate sets `CALIBRATE_E2E_CAPTURE_SCREENSHOTS=1` so successful E2E tests retain screenshot evidence.
- [ ] Test findings park for approval instead of auto-editing code.
- [ ] No frontend, backend, or database process outlives the E2E command.

**Verification:**

- [ ] `no-mistakes axi logs --step test --full` shows bootstrap, target execution, and exit result.
- [ ] A deliberate E2E failure creates a test gate rather than an automatic fix.

**Dependencies:** Tasks 2–4

### Task 6: Add agent guidance

**Description:** Update root `AGENTS.md` with the exact E2E target and local-development-user safety invariant.

**Acceptance criteria:**

- [ ] States `npx nx run web-e2e:e2e --outputStyle=static` as the target command for relevant web/backend changes.
- [ ] States that Playwright’s `webServer` configuration owns frontend and backend process startup/readiness using ports injected by `web-e2e:e2e`.
- [ ] States that `web-e2e:e2e` owns disposable database setup, migration, port selection, and teardown before it invokes the inner `web-e2e:parameterize-playwright` target.
- [ ] States that the focused E2E flow completes the existing local enrollment authorization and passkey ceremony to create a new local-development-only user without using email verification or delivering email.
- [ ] States that the capability is available only for a non-production request with a matching HTTP loopback origin, matching `Origin` header, and loopback client address.
- [ ] States that the explicit E2E no-op email-delivery mode overrides credentials loaded by `dotenvx`, selects `NoopEmailSender`, and requires the test to assert the email-verification endpoints were not used.
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
| Browser binary unavailable or Playwright is too old for virtual passkeys | Provision a Playwright version at least 1.61 and its browsers explicitly; obtain approval before installing either. |
| Frontend or backend server starts against the wrong database | The Testcontainers wrapper supplies an isolated connection only to the Playwright child process; fail closed when absent. |
| Concurrent worktrees bind the same application port | Select a port pair per E2E run, inject it into both servers and all derived origins, and retry only a confirmed bind collision. |
| E2E cannot access Docker | Use the same Docker/Testcontainers permission path as the existing backend integration suite; request the required sandbox approval when running it. |
| Development-only account creation becomes reachable in production | Preserve the server-side non-production, matching-loopback-origin, matching-`Origin`, and loopback-client checks; cover the denied paths with integration tests. |
| E2E accidentally sends real email | Make the explicit E2E no-op email-delivery mode override a credential loaded by `dotenvx`, select `NoopEmailSender`, and assert the browser never invokes either email-verification endpoint. |
| Backend changes do not mark web E2E as affected | Add explicit Nx task/project dependencies or use a deliberately scoped target. |
| E2E leaves processes or containers running | Let Playwright own application-process shutdown and use a database wrapper with cleanup on every exit path. |
| Test agent rewrites intentional local-only behavior | Keep `auto_fix.test: 0`; document the local-only and no-email invariants. |

## Final Acceptance Criteria

- [ ] A clean no-mistakes worktree runs `npm ci`, then `web-e2e:e2e`.
- [ ] Playwright starts, waits for, and cleans up the frontend and backend servers.
- [ ] The target provisions, migrates, and cleans up its own disposable database.
- [ ] The E2E test creates a new local-development-only user through the existing enrollment and passkey-registration flow.
- [ ] The test proves that neither email-verification endpoint is used and that the explicit E2E no-op email-delivery mode prevents delivery even when a local `.env` has a credential.
- [ ] Backend integration tests prove the local-development-only route is unavailable outside the loopback, non-production configuration.
- [ ] Test failures park for human review.
- [ ] The gate produces usable test artifacts and does not require the Desktop Browser plugin.
- [ ] no-mistakes runs retain successful-test screenshots; ordinary local E2E runs retain screenshots only on failure.
