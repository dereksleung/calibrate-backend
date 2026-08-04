# Implementation Plan: Current-Device Logout and Session Revocation

## Outcome and scope

Implement full logout for the current browser/device. The account-menu **Log out** action must call
`DELETE /api/v1/auth/session`; the server must revoke the remembered-device family and its access
sessions, then clear the access and refresh cookies. The browser must clear its authenticated state
only after that idempotent server operation succeeds.

This plan implements the explicit, user-initiated logout path from
[ADR-0002](../../../apps/backend/docs/adr/0002-email-otp-and-cookie-backed-server-sessions.md).
It also establishes the revocation capability required by the later refresh-race recovery flow, but
does **not** implement that `409 REFRESH_ALREADY_ROTATED` workflow in this slice.

**Prerequisite:** complete
[`005-session-restoration.md`](./005-session-restoration.md). It introduces the session-family
tables, cookie helpers, `GET /auth/session`, `POST /auth/session/refresh`, and the frontend
authenticated-session cache that this plan extends.

## Locked decisions

- `DELETE /auth/session` is full logout for the current remembered device, not a client-only
  redirect and not a future remote/all-devices logout API.
- The route returns `204 No Content` and `Cache-Control: no-store`. It never returns an access
  token, refresh token, family identifier, or credential-state detail.
- The route requires the exact configured `Origin` before it reads credentials, clears cookies, or
  changes server state. Missing, `null`, malformed, or unexpected origins receive `403`.
- A valid access-session cookie identifies the family. If the access cookie is absent or unusable,
  a recognized current or consumed refresh-token digest may identify an active family **only for
  revocation**; it must never renew a session or issue credentials.
- Logout is idempotent: with no recognized credential it still clears both cookies and returns
  success without changing server state. A repository/application availability failure is not a
  successful logout and must not cause the client to clear in-memory state or navigate away.
- Cookie clearing reuses the exact access and refresh cookie names, paths, `HttpOnly`, `Secure`,
  and `SameSite` attributes used when cookies are set. The refresh cookie remains scoped to
  `/api/v1/auth/session`, which includes this `DELETE` route.
- The web app centralizes the request in the API client. `Header.tsx` must not make an ad-hoc
  `fetch` call or assume that deleting React Query data logs the browser out.

## Target flow

```text
Account menu: Log out
  -> DELETE /auth/session (credentials + exact Origin)
       -> identify active family from access token, or recognized refresh digest
       -> atomically revoke family and all of its active access sessions
       -> clear access and refresh cookies with matching attributes
       -> 204
  -> remove authenticated/user-scoped client cache
  -> navigate to /signup-login

Unknown or already-revoked credentials
  -> clear both cookies -> 204 -> clear local state -> /signup-login

Origin rejection or availability failure
  -> retain cookies and local state -> show recoverable error; do not navigate
```

## Implementation tasks

### Task 1: Define the logout contract and reusable API-client operation

**Description:** Add a success schema appropriate for a `204 No Content` response and expose a
`deleteCurrentSession(transport)` API-client function. Reuse the shared cookie-enabled transport
and its `Origin` header; do not duplicate browser request logic in the UI.

**Acceptance criteria:**

- [ ] The API client sends `DELETE /auth/session` with no request body and parses a successful
  empty response.
- [ ] The contract exposes no credential, family, or account metadata on success.
- [ ] Errors retain the transport's existing status/body handling without logging cookie material.

**Test plan:**

- [ ] Contract test verifies the empty success representation and rejects credential-shaped data.
- [ ] API-client unit test asserts the exact method, path, no body, and handling of a `204`.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
```

**Dependencies:** Plan 005 session contract.

**Likely files:** `packages/api-contracts/src/auth-responses.ts`,
`packages/api-contracts/src/auth-contracts.test.ts`, `packages/api-client/src/auth/session.ts`,
`packages/api-client/src/auth/session.test.ts`, and package indexes.

**Estimated scope:** S.

### Task 2: Add application-level current-family revocation

**Description:** Extend the session repository port and restoration service with a digest-only
logout operation. Its PostgreSQL transaction determines the active family from the permitted
access/refresh evidence and revokes the family plus every active access session under it.

**Acceptance criteria:**

- [ ] A valid access-session digest revokes its current family and all associated active access
  sessions.
- [ ] A recognized current or consumed refresh digest can revoke an active family without
  authorizing renewal or producing credentials.
- [ ] Unknown, expired, revoked, or otherwise unusable tokens cause no mutation and still produce
  the idempotent service result.
- [ ] Raw tokens are hashed before the application reaches persistence; no schema migration is
  introduced unless inspection proves the existing family/generation relations insufficient.

**Test plan:**

- [ ] Service unit tests cover access-token, current-refresh, consumed-refresh, and unknown-token
  paths with a repository double.
- [ ] Repository integration tests prove family revocation and access-session revocation commit
  atomically, and prove a no-match request has no database mutation.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Plan 005 session-family persistence.

**Likely files:** `apps/backend/src/application/ports/access-session-repository.ts`,
`apps/backend/src/application/services/session-restoration-service.ts`,
`apps/backend/src/infrastructure/persistence/repositories/postgres-access-session-repository.ts`,
and their tests.

**Estimated scope:** M.

### Task 3: Expose origin-protected `DELETE /auth/session`

**Description:** Add the auth route and controller method. The presentation layer owns exact-origin
validation, cookie extraction and clearing, cache-control headers, and mapping the idempotent
application result to HTTP; it must not embed revocation policy.

**Acceptance criteria:**

- [ ] `DELETE /api/v1/auth/session` returns `204` and `Cache-Control: no-store` after a successful
  or no-credential logout.
- [ ] Invalid origin is rejected before any session operation or cookie clearing.
- [ ] Successful responses clear both cookies with the same names, paths, and security attributes
  used at issuance; response bodies never disclose credential state.
- [ ] Persistence/service failures return an availability response and do not falsely clear cookies.

**Test plan:**

- [ ] Controller tests cover valid access-only, refresh-only, consumed-refresh, and no-recognized-
  credential logout, plus exact cookie-clearing options.
- [ ] HTTP integration tests cover the route, `no-store`, origin rejection, idempotency, and token
  absence from headers/bodies other than the expected expired `Set-Cookie` instructions.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Tasks 1 and 2.

**Likely files:** `apps/backend/src/presentation/routes/auth-routes.ts`,
`apps/backend/src/presentation/controllers/auth-controller.ts`, controller/route tests, and cookie
helpers only if a shared clearing helper is needed.

**Estimated scope:** M.

### Task 4: Wire the Header and clear client-auth state after confirmed logout

**Description:** Use the shared API-client operation from `Header.tsx`. While the request is
pending, prevent duplicate logout attempts. After a successful response, remove the authenticated
session and any user-scoped React Query data, then navigate to `/signup-login`. Preserve state and
show a retryable error when logout cannot be confirmed.

**Acceptance criteria:**

- [ ] Clicking **Log out** sends the API request before clearing local auth state or navigating.
- [ ] A successful idempotent response clears cached authenticated/user data and reaches
  `/signup-login`.
- [ ] A network, `5xx`, or origin error leaves the user in the current authenticated UI and offers
  a recoverable error; it is never represented as a successful logout.
- [ ] The component remains accessible while pending, with the action unavailable until the request
  settles.

**Test plan:**

- [ ] Header component tests assert request ordering, pending-state duplicate prevention, successful
  cache cleanup/navigation, and failed-logout preservation of state.
- [ ] Add a focused auth-state helper test if cache cleanup is extracted from the component.

**Verification:**

```sh
npx nx run web:test
npx nx run web:typecheck
```

**Dependencies:** Tasks 1 and 3.

**Likely files:** `apps/web-frontend/src/shared/components/Header.tsx`,
`apps/web-frontend/src/shared/components/Header.test.tsx`,
`apps/web-frontend/src/verticals/auth/authenticated-session.ts`, and a small auth logout helper if
needed.

**Estimated scope:** S.

## Checkpoint: current-device logout

- [ ] Manual browser check: logout removes the account menu, reaches `/signup-login`, and a reload
  cannot restore the just-revoked session.
- [ ] A stale/missing cookie still yields a successful idempotent logout and removes the local
  browser cookies.
- [ ] Failed availability requests leave the session usable and do not redirect.
- [ ] The API-contract/client, backend, and web checks listed above pass.

## Deferred follow-up

The ADR-required `409 REFRESH_ALREADY_ROTATED` recovery is intentionally deferred. When the
cross-tab single-flight refresh coordinator is implemented, its losing-tab path must wait for local
coordination, call `GET /auth/session`, and call `DELETE /auth/session` only when that check returns
`401 ACCESS_SESSION_REQUIRED`. It must not call logout for timeouts, network errors, or `5xx`
responses.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Client-only logout leaves a reusable refresh family | Revoke the family server-side before clearing client state. |
| Refresh cookie cannot reach logout | Keep the logout path under the existing `/api/v1/auth/session` refresh-cookie scope. |
| A stale cookie reveals server state | Always return the same idempotent success after valid-origin processing. |
| An outage is mistaken for logout | Leave cookies and local state intact until the server confirms revocation. |
