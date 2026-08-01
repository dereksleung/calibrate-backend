# Agent handoff: Passkey signup after enrollment authorization

Continuation context for agents working story `003-passkeys-sign-up-after-enrollment-authorization`.

**Plan:** `docs/tasks/passkeys-auth/003-passkeys-sign-up-after-enrollment-authorization.md`

## Workspace

| Item | Value |
|------|-------|
| Path | `/Users/derekleung/clean-architecture-backend-passkeys-signup` |
| Branch | `codex/passkeys-sign-up-after-enrollment-authorization` |
| Commit format | `docs/agents/commit-messages.md` — e.g. `feat(api-client): add passkey registration mutations` |

## Shell and Cursor permissions

- Workspace is already the repo root — **do not** `cd` before `npx nx run`.
- `.cursor/permissions.json` allowlists `npx nx run` and `git commit` (auto-run without command approval prompts).
- `.cursor/sandbox.json` tunes the agent sandbox (Docker registry network, `~/.docker` paths, shared build caches). See **Cursor agent sandbox** below.

### Docker integration tests — approve `full_network`

Backend integration tests use **testcontainers** (`PostgreSqlContainer` in `apps/backend/test/integration/global-setup.ts`). In the Cursor agent shell, that requires talking to the Docker Unix socket (`~/.docker/run/docker.sock`). The default agent sandbox blocks that connection (`connect EPERM`).

**When running any test that starts Docker containers** (primarily `npx nx run backend:test:integration`):

1. Pass `required_permissions: ["full_network"]` on the Shell tool call.
2. **Ask the user to approve** the network/sandbox escalation prompt when Cursor shows it (Allow / Run). That is how `full_network` is granted — the user does not type `required_permissions` themselves.
3. Approval is **per Shell invocation** unless the user chose a persistent “always allow” option in the UI.
4. **`["all"]` is not required** for these tests — `full_network` is enough on this machine.
5. `web:test:integration` does **not** use Docker; default sandbox is usually fine.

Do **not** assume `sandbox.json` alone removes the need for `full_network` for Docker-backed tests.

### Cursor agent sandbox (discovered behavior)

Three layers are separate:

| Layer | Controls |
|-------|----------|
| `.cursor/permissions.json` (`terminalAllowlist`) | Whether the terminal command runs without a “run command?” prompt |
| `.cursor/sandbox.json` | Network allowlists, extra read/write paths, shared caches **inside** the agent sandbox |
| `required_permissions` on Shell | Escalation for that one command (`full_network` or `all`) |

**`sandbox.json` is loaded** (verified after Cursor restart):

- `enableSharedBuildCache` — cache env vars redirect to `cursor-sandbox-cache`.
- `networkPolicy.allow` for Docker registries — `registry-1.docker.io` reachable; unrelated hosts blocked.
- `additionalReadwritePaths` / `additionalReadonlyPaths` — file access under `~/.docker` works.

**Still blocked without `full_network`:**

- Unix socket **connect** to Docker API (`EPERM` on `net.connect(docker.sock)`).
- `docker version` and testcontainers startup (`Could not find a working container runtime strategy`).

Adding `~/.docker/run` to `additionalReadwritePaths` did **not** fix socket connect. macOS Seatbelt treats Docker socket access as a network-class restriction, not plain filesystem read/write.

**Local Network (macOS System Settings)** is unrelated: Cursor’s shipped app does not declare `NSLocalNetworkUsageDescription`, so no Local Network toggle appears. That setting would not replace agent `full_network` for Docker anyway.

## Committed work (Tasks 1–7)

| Commit | Scope |
|--------|--------|
| `aac7e9d` | api-contracts: passkey registration request/response schemas |
| `29f596c` | persistence schema + migration |
| `19784a8` | application service, ports, unit tests |
| `25f0c23` | Postgres repo, SimpleWebAuthn adapter, integration tests |
| `e9cb878` | HTTP routes, cookies, middleware, container, Brevo passkey notification |
| `62c1cc4` | unrelated index refactor on branch |

Task 7 routes: `POST /api/v1/auth/passkeys/registration/options`, `POST /api/v1/auth/passkeys/registration/verify`.

## Uncommitted work (Tasks 8–10)

**Task 8 — api-client**

- `packages/api-contracts/src/passkey-registration-responses.ts` — `PasskeyRegistrationOptionsResponseSchema`
- `packages/api-client/src/auth/signup-passkey-registration.ts` + `.test.ts`
- `packages/api-client/src/errors.ts` — `retryAfterSeconds` on `ApiError`
- `packages/api-client/src/transport.ts` — `Retry-After` on errors
- `packages/api-client/src/index.ts` — exports

**Task 9 — frontend**

- `apps/web-frontend/src/pages/auth/PasskeyEnrollmentPage.tsx` — full ceremony UI
- `apps/web-frontend/src/verticals/auth/browser-passkey-registration-adapter.ts`
- `apps/web-frontend/src/verticals/auth/authenticated-session.ts`
- `apps/web-frontend/src/routes/__root.tsx`, `shared/api/api-client.ts` — Origin header, auth route layout

**Task 10 — tests**

- `apps/backend/src/presentation/routes/__tests__/passkey-registration-routes.integration.test.ts`
- `apps/web-frontend/src/pages/auth/PasskeyEnrollmentPage.test.tsx`
- `apps/web-frontend/src/pages/auth/passkey-signup.integration.test.tsx`

## Verification

| Command | Notes |
|---------|--------|
| `npx nx run @calibrate/api-contracts:test` | default sandbox |
| `npx nx run @calibrate/api-client:test` | default sandbox |
| `npx nx run backend:test` | default sandbox |
| `npx nx run backend:test:integration` | **request `full_network`; user must approve** |
| `npx nx run backend:typecheck` | default sandbox |
| `npx nx run web:test` | default sandbox |
| `npx nx run web:test:integration` | default sandbox; some `logs-live-day-log` failures may be pre-existing |

## Suggested commits

1. `feat(api-contracts): add passkey registration options response schema`
2. `feat(api-client): add passkey registration mutations`
3. `feat(frontend): wire passkey enrollment ceremony UI`
4. `test(backend): cover passkey registration HTTP routes`
5. `test(frontend): cover passkey enrollment and signup handoff`

## Design reminders

- Verify mutation must use `retry: false` (api-client and `PasskeyEnrollmentPage`).
- “Try again” must request **fresh options** and a new browser ceremony — never replay old credential JSON.
- `WEBAUTHN_ORIGIN` defaults to `http://localhost:3000`; web client sends `Origin` via `apiTransport`.
- No PRs requested — commit by task slice for review.

## What remains

1. Run verification (use `full_network` for `backend:test:integration`).
2. Commit Tasks 8–10 in task-scoped slices.
3. Optional: full-stack passkey signup against real backend + DB beyond current HTTP/UI tests.
