# Implementation Plan: Restore a Returning User Session

## Outcome and scope

When Calibrate starts, the client establishes the user state from the server rather than from
browser storage:

1. Call `GET /api/v1/auth/session` with the access cookie.
2. On `200`, cache the returned `AuthenticatedSessionResponse` and render as authenticated.
3. On `401 ACCESS_SESSION_REQUIRED`, make one `POST /api/v1/auth/session/refresh` attempt.
4. On refresh success, read the session again and continue as authenticated.
5. When no usable refresh cookie/family remains, clear only in-memory auth state and present the
   existing passkey-login route. A successful passkey login creates the replacement family.

This is a small vertical slice, not the complete lifecycle in ADR-0002. It deliberately excludes
cross-tab `Web Locks`/`BroadcastChannel` coordination, consumed-token `409` recovery, explicit
family revocation/logout, the 30-day re-authentication ceremony, and automatic retry/backoff for
availability failures. Those need their own slices because they change the refresh threat model.

**Prerequisite:** complete `004-passkey-login-existing-credential.md`, including its explicit
passkey-login page and authenticated-session cache helper. The frontend fallback below is that
existing sign-in experience; it must not invent an email-OTP fallback.

## Locked decisions

- `GET /auth/session` validates only the access cookie. It never consumes, rotates, or even
  depends on the refresh cookie.
- `POST /auth/session/refresh` is the only automatic refresh attempt. It requires the refresh
  cookie and exact allowed `Origin`, rotates it atomically, replaces the access session, and sets
  both `HttpOnly` cookies only after commit.
- Both successful endpoints return the existing `AuthenticatedSessionResponse` and use
  `Cache-Control: no-store`; neither sends credentials in JSON.
- A missing, expired, revoked, or otherwise unusable refresh token produces a stable unauthenticated
  result. It is not an availability error and must not cause a retry loop.
- Network errors and `5xx` leave cookies and in-memory identity untouched, expose a recoverable
  unavailable state, and require an explicit retry. They never imply logout.
- This slice keeps refresh single-tab. If two refreshes race, the backend must fail safely; the
  client does not retry an ambiguous request. Full `REFRESH_ALREADY_ROTATED` coordination is
  deferred with the rest of the concurrency slice.

## Target flow

```text
App bootstrap
  -> GET /auth/session
       -> 200: cache user -> authenticated UI
       -> 401: POST /auth/session/refresh
                 -> 200: GET /auth/session -> cache user -> authenticated UI
                 -> 401: no in-memory user -> passkey sign-in UI
                 -> network/5xx: recoverably unavailable -> explicit Retry
```

## Implementation tasks

### Task 1: Define the session-restoration HTTP contract

**Description:** Add the session-specific response/error schemas and API-client functions while
reusing `AuthenticatedSessionResponse` for success. Keep the wire contract intentionally small so
the web bootstrap can distinguish an expected unauthenticated state from an unavailable backend.

**Acceptance criteria:**

- [ ] `GET /auth/session` success parses as `AuthenticatedSessionResponse`; its only expected
  authentication failure is `401 ACCESS_SESSION_REQUIRED`.
- [ ] `POST /auth/session/refresh` has no JSON request body and returns the same success shape.
- [ ] Refresh has a stable `401` error for a missing or unusable refresh credential; no token,
  family, or replay detail is exposed.
- [ ] API-client calls use `credentials: "include"`, validate every response, and never log cookie
  values or error bodies containing credential material.

**Test plan:**

- [ ] Contract tests accept the exact authenticated-session response and reject token-shaped or
  unknown fields.
- [ ] Contract tests cover the two stable unauthenticated error responses and reject unexpected
  error fields.
- [ ] API-client tests assert HTTP method/path, credential inclusion, valid parsing, and safe
  propagation of `401` versus network/`5xx` errors.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
```

**Dependencies:** Passkey-login contracts from plan 004.

**Likely files:** `packages/api-contracts/src/auth-*.ts`, `packages/api-client/src/auth/session.ts`,
their tests, and package indexes.

**Estimated scope:** M.

### Task 2: Implement atomic refresh persistence and application service

**Description:** Introduce a session-family repository port and PostgreSQL implementation that
looks up only refresh-token digests and performs rotation plus access-session replacement in one
transaction. Reuse `NodeOpaqueTokenService`, `calculateSessionLifetimes`, the established
remembered-device tables, and the existing user repository.

**Acceptance criteria:**

- [ ] The transaction verifies active family, current generation, family inactivity expiry, and
  family absolute expiry before issuing replacement credentials.
- [ ] It marks the presented generation consumed, creates exactly one successor generation, slides
  family inactivity only to `min(now + 7 days, family.absoluteExpiry)`, replaces/revokes the prior
  access session, and creates one new short access session.
- [ ] The database retains only SHA-256 token digests; raw access and refresh values leave the
  service only to be set as cookies by presentation.
- [ ] Missing, expired, revoked, or non-current refresh state produces the stable unauthenticated
  service result without issuing credentials. A transaction failure creates no partial rotation.

**Test plan:**

- [ ] Unit-test service mapping for current, missing, expired, revoked, and absolute-expired
  families.
- [ ] Repository-integration tests prove successor generation, old-access replacement, family
  expiry cap, and new access session commit atomically.
- [ ] Assert failed transactions leave the presented generation usable and no successor/session
  rows behind; assert stored columns contain only digests.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 1.

**Likely files:** `apps/backend/src/application/ports/*session*`,
`apps/backend/src/application/services/*session*`,
`apps/backend/src/infrastructure/persistence/repositories/*session*`, and repository tests.

**Estimated scope:** M.

### Task 3: Expose session read and refresh endpoints

**Description:** Wire the application service into the container and auth controller. Add the
ordinary access-session lookup endpoint and the origin-protected refresh endpoint, centralizing
cookie issuance so login, signup, and refresh maintain identical cookie attributes and expiry
capping.

**Acceptance criteria:**

- [ ] `GET /api/v1/auth/session` reads only the access cookie, validates the active server session,
  and returns the current user or `401 ACCESS_SESSION_REQUIRED`.
- [ ] `POST /api/v1/auth/session/refresh` rejects missing/malformed/unexpected `Origin` before
  state change; with a usable cookie it rotates and sets access plus refresh cookies after commit.
- [ ] Both endpoints send `Cache-Control: no-store`; all authentication outcomes avoid bearer or
  cookie data in JSON.
- [ ] A failed refresh clears no cookies in this minimal slice. An explicit logout/replay-revocation
  slice will own clearing when server state requires it.

**Test plan:**

- [ ] Controller tests cover user mapping, cookie attributes, and stable errors.
- [ ] HTTP integration tests cover valid access restoration, expired access followed by refresh,
  missing refresh cookie, invalid Origin, `no-store`, and absence of tokens from bodies.
- [ ] Middleware/regression tests prove refresh is outside ordinary access middleware and the
  refresh cookie remains scoped to `/api/v1/auth/session`.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 2.

**Likely files:** `apps/backend/src/presentation/routes/auth-routes.ts`,
`apps/backend/src/presentation/controllers/auth-controller.ts`,
`apps/backend/src/infrastructure/container.ts`, cookie helpers, and HTTP tests.

**Estimated scope:** M.

### Task 4: Add a startup session-restoration coordinator

**Description:** Build one frontend auth-state coordinator at the app root. It performs the flow
above once per app start, writes only a verified server session into React Query, and routes an
expected unauthenticated result to the existing passkey sign-in UI without flashing protected data.

**Acceptance criteria:**

- [ ] UI has explicit `checking`, `authenticated`, `refreshing`, `unauthenticated`, and
  `recoverably-unavailable` states.
- [ ] A valid access session avoids refresh; an expired access session makes exactly one refresh
  attempt; a successful refresh is followed by a session read before caching identity.
- [ ] Missing/invalid refresh ends in the passkey sign-in UI and removes any stale in-memory
  authenticated-session query value; it does not clear `HttpOnly` cookies from JavaScript.
- [ ] Network/`5xx` failures retain no newly asserted identity, show a retry action, and do not
  redirect to sign-in or auto-replay protected mutations.
- [ ] Root layout and protected route rendering use this coordinator, rather than the commented
  placeholder authentication logic in `routes/__root.tsx`.

**Test plan:**

- [ ] Component tests cover each state and exact call sequence: session success; session `401` +
  refresh success + second session success; session `401` + refresh `401`; and network/`5xx`.
- [ ] Routing integration test verifies a returning user reaches a protected route only after the
  server session is cached, while no-refresh users reach `/signup-login` without protected content.
- [ ] Assert each request uses credentialed fetch and that retry is user initiated for availability
  errors.

**Verification:**

```sh
npx nx run web:test
npx nx run web:typecheck
```

**Dependencies:** Tasks 1 and 3; passkey-login UI from plan 004.

**Likely files:** `apps/web-frontend/src/verticals/auth/*`,
`apps/web-frontend/src/routes/__root.tsx`, `apps/web-frontend/src/main.tsx`, and focused route tests.

**Estimated scope:** M.

## Checkpoint: complete restoration slice

- [ ] Expired access + valid refresh returns the user to Calibrate without a passkey prompt.
- [ ] Expired access + no usable refresh presents passkey sign-in and leaks no protected data.
- [ ] All successful authentication/session responses are `no-store` and contain no credentials.
- [ ] Backend unit/integration tests, API-contract/client tests, and web tests/typechecks above pass.
- [ ] Review the diff to confirm no unrelated change (including the currently modified
  `passkey-authentication-requests.ts`) is included.

## Deferred follow-up slices

- Cross-tab single-flight refresh, fixed-window `409 REFRESH_ALREADY_ROTATED` recovery, and
  recognized-consumed-token family revocation.
- Current-device `DELETE /auth/session` logout and cookie clearing, specified in
  [`006-current-device-logout-and-session-revocation.md`](./006-current-device-logout-and-session-revocation.md).
- Family-absolute-expiry `REAUTHENTICATION_REQUIRED` ceremony and replacement family.
- Five-minute jittered retry for idempotent session checks on sleeping-backend failures.
- Protecting every domain route/mutation and deciding the exact pre-auth route-shell UX.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Refresh race creates inconsistent credentials | One database transaction with row lock/conditional current-generation update; do not retry an ambiguous refresh. |
| Frontend mistakes an outage for logout | Treat network and `5xx` as recoverably unavailable; retain cookies and require explicit retry. |
| Refresh cookie reaches ordinary APIs | Preserve the narrow `/api/v1/auth/session` cookie path and test it. |
| Scope grows into all lifecycle controls | Keep the listed concurrency, logout, reauthentication, and retry behavior as separately planned follow-ups. |
