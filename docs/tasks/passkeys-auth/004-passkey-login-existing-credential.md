# Implementation Plan: Login with an Existing Passkey

## Summary and Locked Decisions

Implement a complete usernameless login slice for an existing discoverable passkey, following
[`ADR-0002`](../../../apps/backend/docs/adr/0002-email-otp-and-cookie-backed-server-sessions.md).

WebAuthn cannot silently disclose whether a passkey exists. The page will instead start
privacy-preserving conditional mediation when `/signup-login` loads. Matching passkeys can then
appear in the browser's autofill UI after user interaction. An explicit **Sign in with a passkey**
button remains available for unsupported conditional UI, security keys, cross-device
authentication, and manual selection.

Locked decisions:

- Successful login records a `family-created` security event. Counter anomalies may record a
  separate security event.
- Login does **not** send an email notification. The login service will not depend on
  `IEmailSender`.
- "Caching the authenticated user" means placing `AuthenticatedSessionResponse` in the existing
  in-memory React Query cache through `setAuthenticatedSession(queryClient, session)`.
  - No Redis or backend cache is introduced.
  - Authentication responses retain `Cache-Control: no-store`; HTTP intermediaries must not
    cache them.
  - The React Query value is non-authoritative UI state and disappears on a full reload unless a
    persister is added later.
- The authentication-options limit defaults to **40 requests per IP per rolling hour**.
- The verification limit remains **30 requests per IP per rolling hour**.
- Thresholds are configuration values so they can be tuned without a migration. The 40-request
  default accepts some shared-NAT risk in exchange for tighter protection of the automatic
  page-load endpoint.
- Each implementation task includes its own focused test plan.

## Public Interfaces and Data Flow

### API contracts

Add strict schemas and exported types under `@calibrate/api-contracts`.

`POST /api/v1/auth/passkeys/authentication/options`

- Empty request body.
- Requires the exact configured `Origin` and a trusted `req.ip`.
- Returns:

```ts
interface PasskeyAuthenticationOptionsResponse {
  options: {
    challenge: string;
    rpId: string;
    timeout: 300_000;
    userVerification: "required";
    // allowCredentials is omitted for usernameless discovery
  };
  expiresAt: string;
}
```

`POST /api/v1/auth/passkeys/authentication/verify`

```ts
interface VerifyPasskeyAuthenticationRequestBody {
  credential: AuthenticationResponseJSON;
  rememberDevice: boolean;
}
```

Successful response reuses:

```ts
interface AuthenticatedSessionResponse {
  user: UserResponse;
  sessionTransport: "cookie";
}
```

No challenge, credential material, access token, or refresh token appears in success JSON, logs,
URLs, or JavaScript-readable storage.

Stable errors:

| Status | Code | Client behavior |
| --- | --- | --- |
| `400` | `PASSKEY_AUTHENTICATION_FAILED` | Unknown or revoked credential, invalid/expired challenge, user-handle mismatch, failed WebAuthn verification, or exhausted attempts; request fresh options. |
| `403` | `ORIGIN_NOT_ALLOWED` | Do not retry from the current origin. |
| `409` | `PASSKEY_AUTHENTICATION_STATE_CONFLICT` | Another request consumed or changed the ceremony; never replay the assertion. |
| `429` | `PASSKEY_AUTHENTICATION_RATE_LIMITED` | Honor `Retry-After`, then request fresh options. |
| `503` | `PASSKEY_AUTHENTICATION_UNAVAILABLE` | Preserve cookies and provide manual retry. |

Both endpoints return `Cache-Control: no-store`.

### Backend authentication lifecycle

- Make `webauthn_challenges.enrollment_authorization_id` nullable. Login challenges use purpose
  `passkey-login` without a known user.
- Generate a random 32-byte challenge with a five-minute expiry and at most five failed
  verification attempts. Persist only its SHA-256 digest.
- Look up the challenge by digest and the active credential by `credential.id`.
- Require the assertion `userHandle` to match the credential owner's stable
  `users.webauthn_user_handle`.
- Verify the challenge, exact origin, RP ID, ceremony type, signature, credential public key,
  algorithm, user presence, and `userVerification: "required"`.
- Enforce monotonic counters for single-device credentials.
- Treat non-monotonic counters from backup-eligible synced credentials as risk signals: record an
  anomaly event, persist the maximum observed counter, and rely on the single-use challenge—not
  the counter—for replay prevention.
- Atomically:
  - consume the challenge;
  - update passkey counter, backup state, and `last_used_at`;
  - create a remembered-device family;
  - create refresh generation zero;
  - create the short access session; and
  - record `family-created`.
- Do not call the email sender for login or counter-anomaly events.
- Reuse the ADR lifetimes: 30-minute access inactivity, eight-hour access absolute, seven-day
  family inactivity, and 30-day family absolute.
- Reuse centralized cookie issuance. An unchecked `rememberDevice` makes only the refresh cookie
  session-only.

### Frontend lifecycle

- Render the email input with `autocomplete="email webauthn"` before starting conditional
  mediation.
- Feature-detect WebAuthn and conditional autofill.
- On supported browsers, request options once per mounted page and call
  `startAuthentication({ useBrowserAutofill: true })`.
- Keep an explicit passkey button:
  - reuse current unexpired options when possible;
  - abort the pending conditional request before starting standard mediation;
  - otherwise request fresh options.
- Abort the active ceremony on unmount or before submitting the email-signup form.
- Never automatically replay verification.
- On success:
  - call `setAuthenticatedSession(queryClient, response)`;
  - navigate to `/`.
- Treat the React Query value only as immediate client UI state. Later session restoration will
  replace it from `GET /auth/session`.

### Shared abuse limiting

Add PostgreSQL-backed rolling-window events containing only:

- scope;
- HMAC-digested requesting IP; and
- timestamp.

Initial configurable defaults:

- Options: 40 requests per IP per rolling hour.
- Verification: 30 requests per IP per rolling hour.
- Global ceiling: 10,000 requests per scope per rolling hour.

Count-and-insert is serialized through a scoped PostgreSQL advisory transaction lock so
enforcement works across replicas. Return an accurate `Retry-After` based on the oldest event
retaining the limit. Opportunistically remove events older than 24 hours. Never persist or log raw
IP addresses, credential IDs, assertions, cookies, or bearer tokens.

## Implementation Tasks

### Story and branch setup

Create story integration branch:

```text
codex/passkey-login-existing-passkey
```

Each task uses a dedicated sequential subtask branch and focused commit. Inspect the diff before
every commit, branch switch, or PR.

### Task 1: Shared passkey-authentication contracts

Branch:

```text
codex/passkey-login-existing-passkey/api-contracts
```

Implement:

- Authentication options response schema.
- Authentication assertion request schema.
- Stable error-code schema.
- Exports from `@calibrate/api-contracts`.
- Reuse of `AuthenticatedSessionResponse`.

Acceptance:

- Contracts are strict and reject unexpected top-level or nested fields.
- WebAuthn binary values accept only the project's expected base64url representation.
- Success JSON contains no access token, refresh token, or raw challenge outside the WebAuthn
  options response.
- `rememberDevice` is required and boolean.

Task test plan:

- Accept a complete valid `AuthenticationResponseJSON`.
- Accept optional `userHandle` only where permitted by the wire format.
- Reject missing `id`, mismatched/invalid structural fields, invalid `type`, malformed base64url,
  missing signatures, and extra fields.
- Accept the exact options response with `userVerification: "required"`.
- Reject an options response with malformed expiry, missing RP ID, or unexpected identity fields.
- Assert every stable error code round-trips.
- Assert the authenticated-session response rejects token-shaped extra properties.

Verify:

```sh
npx nx run @calibrate/api-contracts:test
```

Commit and immediately open the API-contracts PR to the story branch.

### Task 2: Challenge and shared-rate-limit persistence

Branch from the merged contract story branch:

```text
codex/passkey-login-existing-passkey/backend-persistence
```

Implement:

- Migration making enrollment authorization optional for login challenges.
- Rate-limit event table and rolling-window indexes.
- Kysely schema types and integration cleanup fixtures.
- Authentication repository preparation methods for rate limiting and challenge creation.
- Digest-only challenge and IP persistence.
- Five-minute challenge expiry and five-attempt cap.

Acceptance:

- Registration challenges continue requiring an enrollment authorization.
- Login challenges can exist without enrollment or user identity.
- Options count-and-challenge insertion is atomic.
- Limits are shared across repository instances.
- Raw challenges and IP addresses never enter PostgreSQL.
- Rejected requests receive deterministic retry timing.

Task test plan:

- Preserve registration challenge behavior after the nullable migration.
- Create a login challenge with the correct purpose, expiry, and null enrollment authorization.
- Confirm only the challenge digest and IP HMAC exist in stored rows.
- Allow requests 1–40 from one IP within the rolling hour.
- Reject request 41 with the expected `Retry-After`.
- Permit the same IP after the oldest event leaves the rolling window.
- Verify separate HMAC digests do not share the per-IP bucket.
- Enforce the 30-request verification bucket independently from options.
- Enforce the configurable global ceiling across repository instances.
- Prove concurrent request 40/41 cannot both pass.
- Remove events older than 24 hours without affecting active-window counts.
- Confirm database failures roll back both rate-limit consumption and challenge creation.

Verify:

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

### Task 3: Authentication service and SimpleWebAuthn adapter

Branch from Task 2:

```text
codex/passkey-login-existing-passkey/backend-webauthn
```

Implement:

- Passkey-authentication application port and service.
- Safe application errors and unavailable implementation.
- SimpleWebAuthn authentication adapter.
- Shared session-lifetime calculator reused by signup and login.
- Explicit single-device versus backup-eligible counter policy.
- No email-sender dependency.

Acceptance:

- Options omit `allowCredentials` and require UV.
- Verification uses only trusted challenge, configuration, and persisted credential data.
- Unknown or revoked credentials and all cryptographic failures produce the same public failure.
- Every failed assertion requires fresh options.
- Login and counter anomalies produce security events only, never notifications.

Task test plan:

- Generate unique 32-byte challenges with five-minute expiry.
- Assert RP ID, timeout, empty user identity, omitted `allowCredentials`, and required UV.
- Reject wrong origin before credential completion.
- Verify valid single-device and synced-passkey assertions.
- Reject wrong challenge, type, origin, RP ID, signature, algorithm, UP, or UV.
- Reject a missing or mismatched user handle.
- Reject a revoked or unknown credential generically.
- Enforce monotonic single-device counters.
- Accept a synced-passkey non-monotonic counter while returning an anomaly result.
- Reject impossible backup flag combinations.
- Assert failed verification increments the challenge attempt count.
- Assert the fifth failed attempt exhausts the challenge.
- Assert no automatic retry occurs.
- Assert login service construction and successful execution require no `IEmailSender`.
- Re-run signup lifetime tests to prove the shared calculator preserves existing behavior.

Verify:

```sh
npx nx run backend:test
npx nx run backend:typecheck
```

### Task 4: Atomic login completion and HTTP endpoints

Branch from Task 3:

```text
codex/passkey-login-existing-passkey/backend-http
```

Implement:

- Atomic repository completion transaction.
- Container wiring.
- Options and verification controller actions and routes.
- Exact-origin and trusted-IP validation.
- Shared cookie-authenticated-session response helper.
- Safe HTTP error mapping, `Retry-After`, and `Cache-Control: no-store`.

Acceptance:

- Exactly one transaction owns challenge consumption, credential updates, family creation, refresh
  generation, session creation, and security event recording.
- Successful login creates a new family without extending an existing family.
- `family-created` and counter-anomaly events do not dispatch email.
- Cookie attributes match ADR-0002 in production and localhost modes.
- No web JSON contains bearer credentials.

Task test plan:

Repository integration:

- Complete a valid login and assert every expected row and relationship.
- Assert access and refresh values are stored only as digests.
- Assert the passkey's last-used time, backup state, and counter update.
- Assert exactly one `family-created` event.
- Assert no passkey-added event is created.
- Assert a synced counter anomaly creates only its security event.
- Roll back all writes if any family, token, session, event, or credential update fails.
- Race two verifications of one challenge and prove exactly one succeeds.
- Reject expired, consumed, invalidated, wrong-purpose, or attempt-exhausted challenges.
- Preserve independent valid login ceremonies as independent families.

Controller and HTTP integration:

- Reject missing, `null`, malformed, and unexpected origins before state changes.
- Return `503` when a trusted request IP is unavailable.
- Validate strict request bodies.
- Map `400`, `403`, `409`, `429`, and `503` to stable bodies.
- Set accurate `Retry-After` on `429`.
- Assert `Cache-Control: no-store` on both endpoints.
- Assert production and localhost access-cookie names, paths, flags, and expiry.
- Assert persistent and session-only refresh-cookie variants.
- Assert response bodies and captured logs contain no tokens, cookies, raw challenges, or
  assertions.
- Use a fake email sender and assert it receives zero login-related calls.

Verify:

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

Open the combined backend PR to the story branch after these checks pass.

### Task 5: API-client authentication mutations

Branch from the story branch after backend merge:

```text
codex/passkey-login-existing-passkey/api-client
```

Implement:

- Options and verification request functions.
- React Query mutation helpers.
- Stable passkey-authentication error parser.
- Explicit `retry: false` behavior.

Acceptance:

- Exact paths, methods, request bodies, and response schemas are used.
- Verification cannot be replayed by React Query.
- `Retry-After` remains available through `ApiError`.
- No API-client type exposes access or refresh tokens.

Task test plan:

- Assert the options call uses the exact POST path and no body.
- Parse a valid options response and server expiry.
- Reject malformed success responses.
- Assert verification sends one credential and `rememberDevice`.
- Parse `AuthenticatedSessionResponse`.
- Assert all stable authentication errors are recognized.
- Assert unknown/non-API errors return no stable code.
- Assert mutation definitions disable retries.
- Simulate network and `5xx` failures and prove no second request occurs.
- Assert success data contains only the user and session transport.

Verify:

```sh
npx nx run @calibrate/api-client:test
```

### Task 6: Conditional and explicit browser login

Branch from Task 5:

```text
codex/passkey-login-existing-passkey/web-passkey-login
```

Implement:

- Browser authentication adapter using SimpleWebAuthn.
- Conditional capability detection.
- Conditional ceremony orchestration on page entry.
- Explicit passkey button fallback.
- Remember-device control.
- React Query authenticated-session update and navigation.
- Unified page copy separating login from new-account signup.

Acceptance:

- At most one active WebAuthn ceremony exists.
- React development effect replay does not create duplicate options requests.
- Conditional failure never blocks explicit login or account creation.
- Expired or failed assertions are never resubmitted.
- Success updates only the React Query in-memory cache and navigates to `/`.
- No browser storage, service worker cache, or HTTP cache is introduced for authentication data.

Task test plan:

Browser adapter:

- Detect full WebAuthn support separately from conditional autofill support.
- Call `startAuthentication` with `useBrowserAutofill: true` for conditional mode.
- Call standard mediation for explicit mode.
- Cancel the active ceremony on request.
- Classify expected abort/cancellation separately from unexpected errors.

Page and integration tests:

- Render `autocomplete="email webauthn"` before conditional startup.
- Start exactly one options request on a supported page mount.
- Do not start conditional authentication when conditional UI is unsupported.
- Keep the explicit passkey button available when conditional UI is unsupported.
- Reuse unexpired options when switching to the explicit button.
- Request fresh options after expiry or verification failure.
- Abort conditional mediation before standard mediation, signup submission, and unmount.
- Keep cancellation non-destructive and allow manual retry.
- Map `400`, `403`, `409`, `429`, network failure, and `5xx` to accessible UI states.
- Display the server's retry delay for `429`.
- Prevent duplicate clicks while verification is pending.
- Send the current remember-device value at verification time.
- On success, assert `authenticatedSessionQueryKey` contains the response.
- Assert no Redis, HTTP-cache, local-storage, or session-storage interaction.
- Assert navigation to `/` occurs once.
- Assert failed login does not clear or overwrite existing cached session state.

Verify:

```sh
npx nx run web:test
npx nx run web:typecheck
```

### Task 7: Full vertical verification and documentation

Branch from Task 6:

```text
codex/passkey-login-existing-passkey/vertical-integration
```

Implement:

- End-to-end vertical integration using deterministic/fake WebAuthn infrastructure.
- Final documentation alignment with ADR-0002.
- Save this plan at the artifact target.
- Inspect final diff and open the frontend/backend wiring PR to the story branch.

Acceptance:

- A previously registered discoverable passkey completes usernameless login through both
  conditional and explicit paths.
- Backend persistence, cookies, frontend React Query state, and navigation agree.
- Login records security events without sending email.
- The production gate and deferred session-restoration behavior remain explicit.

Task test plan:

- Seed a user and discoverable passkey, request options, create an assertion, verify it, and
  inspect all resulting rows.
- Exercise the same backend endpoints through conditional and explicit frontend orchestration.
- Access a protected backend route using the issued access cookie.
- Assert the refresh cookie is sent only on its scoped session path.
- Repeat with `rememberDevice` disabled and verify a session-only refresh cookie.
- Replay the assertion and confirm no second family/session is created.
- Race concurrent verification and confirm one atomic winner.
- Exercise expired challenge, revoked credential, wrong origin, wrong RP, missing UV, and
  counter-anomaly paths.
- Exhaust both per-IP limit scopes and verify recovery after the rolling window.
- Capture response bodies and logs and scan for raw tokens, cookies, challenges, assertions, and
  IP addresses.
- Assert the fake email sender receives no login or anomaly notification.
- Confirm the React Query cache is populated after success and empty again in a fresh client
  instance, documenting that page-reload restoration is deferred.

Final verification:

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
npx nx run web:test
npx nx run web:typecheck
```

## Deferred Work and Assumptions

- The installed SimpleWebAuthn v13 packages are sufficient; no dependency installation is
  required.
- `rememberDevice` defaults to `true`, matching signup.
- Successful login creates a new remembered-device family with recent-authentication purpose
  `login`.
- Access-session freshness checks, `GET /auth/session`, refresh rotation, cross-tab refresh
  coordination, and refresh fallback are the next slice.
- Until restoration exists, visiting `/signup-login` may begin conditional authentication even
  when an access cookie remains valid.
- React Query state is an immediate UI handoff, not proof of authentication and not durable
  session restoration.
- Email recovery, reauthentication, sensitive-operation step-up, passkey management, password
  removal, and native login remain out of scope.
- The 40-options-per-IP default should be monitored for shared-network false positives and adjusted
  through configuration if legitimate traffic approaches the limit.
- Production authentication remains subject to the complete ADR-0002 cookie-authentication
  shipping gate.
