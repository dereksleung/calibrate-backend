# Implementation Plan: New-User Passkey Signup After Enrollment Authorization

## Summary

Implement the small, complete web vertical slice that starts after signup email
verification has issued the existing five-minute limited enrollment cookie. The
user requests WebAuthn registration options, creates a discoverable passkey,
and submits the browser response for verification.

Successful verification atomically:

1. consumes the WebAuthn challenge and enrollment authorization;
2. creates the passwordless user with the verified recovery email;
3. binds the user's stable WebAuthn handle and first passkey;
4. creates the first remembered-device family, refresh-token generation, and
   short access session;
5. records the security event;
6. clears the enrollment cookie and issues the access and refresh cookies; and
7. returns the authenticated-user representation without exposing any bearer
   credential in JSON.

This plan follows
[`ADR-0002`](../../../apps/backend/docs/adr/0002-email-otp-and-cookie-backed-server-sessions.md).
`POST /auth/passkeys/registration/options` supports only new-user enrollment in
this slice. Recovery and authenticated credential management are explicitly
deferred.

## Goals and Success Criteria

- A browser holding a valid enrollment cookie can complete passkey creation
  through:
  - `POST /api/v1/auth/passkeys/registration/options`
  - `POST /api/v1/auth/passkeys/registration/verify`
- The credential is discoverable and requires user verification, enabling a
  later usernameless authentication flow.
- No user exists until email control and a valid passkey registration response
  have both been proven.
- Exactly one concurrent verification can create the user, credential, family,
  and sessions.
- PostgreSQL stores only digests of enrollment, challenge, access, and refresh
  bearer values; raw values never enter JSON, logs, or persisted records.
- The existing passkey-enrollment page performs the browser ceremony with
  accessible pending, cancellation, retry, expiry, and failure states.
- Neither TanStack Query nor application code automatically replays a passkey
  verification mutation.

## Scope Boundaries

### In scope

- Shared request, response, and error contracts for both registration
  endpoints.
- New-user registration options and verification application services.
- A SimpleWebAuthn infrastructure adapter using the already-installed server
  and browser packages.
- Purpose-bound registration challenges and first-passkey persistence.
- The minimum remembered-device, refresh-token, and access-session persistence
  necessary to complete ADR-0002 signup.
- Production and localhost cookie definitions.
- Cookie access-session validation for protected browser requests while
  preserving the legacy bearer path during migration.
- API-client mutations and the existing web passkey-enrollment page.
- Focused unit, repository-integration, HTTP-integration, and web tests.

### Out of scope

- Recovery-authorized passkey registration.
- Adding or removing passkeys for an authenticated user.
- Passkey authentication, reauthentication, or sensitive-operation step-up.
- Refresh-token rotation and `POST /auth/session/refresh`.
- Conditional passkey UI or passkey autofill.
- Authenticator attestation or enterprise authenticator policy.
- Native iOS or Android enrollment-token delivery.
- User-facing passkey naming and remembered-device management.
- Removing the legacy password, JWT, or bearer-authentication paths.
- Production enablement before every ADR-0002 cookie-authentication shipping
  gate has passing evidence.

## Public API Contracts

### `POST /api/v1/auth/passkeys/registration/options`

The browser sends no request body. The endpoint requires:

- the path-scoped enrollment cookie;
- an exact configured `Origin` header; and
- an active cookie-bound enrollment authorization.

On `200`, return `PublicKeyCredentialCreationOptionsJSON` directly. The options
must include:

```ts
{
  authenticatorSelection: {
    residentKey: "required",
    userVerification: "required",
  },
  attestation: "none",
  // authenticatorAttachment is intentionally omitted
}
```

Additional policy:

- The WebAuthn `user.id` is the stable random user handle, not the email or
  internal user UUID.
- `user.name` and `user.displayName` may use the verified email because they
  are display metadata, not the user handle.
- The RP ID, RP name, origin, challenge, and timeout come only from trusted
  backend state and configuration.
- The challenge expires no later than the fixed enrollment authorization.
- Repeating the endpoint reuses the stable user handle but invalidates the
  previous active challenge before installing a new one.
- Calling the endpoint never extends the enrollment expiry.

### `POST /api/v1/auth/passkeys/registration/verify`

The endpoint requires the same enrollment cookie and exact `Origin`. The
request is:

```ts
interface VerifyPasskeyRegistrationRequest {
  credential: RegistrationResponseJSON;
  rememberDevice: boolean;
}
```

On `200`, return the existing authenticated-session representation:

```ts
interface AuthenticatedSessionResponse {
  user: UserResponse;
  sessionTransport: "cookie";
}
```

The response must never contain the enrollment, access, or refresh token.
`rememberDevice` changes only browser persistence of the refresh cookie. The
server-side family retains the same inactivity and absolute limits either way.

### Safe error contract

New registration endpoints return a stable code without cryptographic,
database, account-existence, or credential details:

```ts
interface PasskeyRegistrationErrorResponse {
  error:
    | "ORIGIN_NOT_ALLOWED"
    | "ENROLLMENT_AUTHORIZATION_REQUIRED"
    | "PASSKEY_REGISTRATION_FAILED"
    | "PASSKEY_REGISTRATION_STATE_CONFLICT"
    | "PASSKEY_REGISTRATION_RATE_LIMITED"
    | "PASSKEY_REGISTRATION_UNAVAILABLE";
}
```

Status mapping:

| Status | Code | Meaning and client action |
| --- | --- | --- |
| `400` | `PASSKEY_REGISTRATION_FAILED` | Malformed or failed WebAuthn verification. Do not replay the assertion; the user may start a fresh ceremony while enrollment remains active. |
| `401` | `ENROLLMENT_AUTHORIZATION_REQUIRED` | Cookie is missing or authorization is expired, consumed, invalidated, or incorrectly bound. Return to email verification. |
| `403` | `ORIGIN_NOT_ALLOWED` | Missing, `null`, malformed, or unexpected origin. Do not retry. |
| `409` | `PASSKEY_REGISTRATION_STATE_CONFLICT` | Conditional consumption lost a race or signup state changed. Do not replay verification. |
| `429` | `PASSKEY_REGISTRATION_RATE_LIMITED` | Wait for `Retry-After`, then start a fresh ceremony if enrollment is still valid. |
| `503` | `PASSKEY_REGISTRATION_UNAVAILABLE` | Availability failure. Never infer logout or blindly replay verification. |

Every response from the two endpoints uses `Cache-Control: no-store`.

## Retry and Ambiguous-Outcome Policy

### Frontend mutation policy

Both endpoint calls are modeled as TanStack Query mutations because requesting
options creates server-side challenge state. Verification explicitly uses:

```ts
useMutation({
  mutationKey: ["verifyPasskeyRegistration"],
  mutationFn: verifyPasskeyRegistration,
  retry: false,
  throwOnError: false,
});
```

Although mutations do not retry by default, `retry: false` documents and locks
the security-sensitive behavior. The UI disables duplicate submission while
the complete ceremony is pending. Do not use a mutation scope to queue a second
submission.

A user-facing **Try again** action starts the whole ceremony again:

1. request fresh options;
2. call `startRegistration()` with those options; and
3. submit the newly returned credential.

It must never retain and resubmit an earlier `RegistrationResponseJSON`.

### Browser and HTTP outcomes

- Authenticator cancellation or timeout is locally retryable through a fresh
  ceremony and is not sent to the verification endpoint.
- A known `400` verification failure is user-retryable only by requesting new
  options and invoking the authenticator again.
- `401` and `403` are terminal for the current enrollment flow.
- `429` becomes user-retryable only after `Retry-After` and only if the
  enrollment authorization remains valid.
- `409`, `5xx`, a network timeout, or a lost response must not automatically
  replay the verification mutation.

### Known ambiguous-completion limitation

The transaction may commit while the response carrying `Set-Cookie` is lost.
Because the database stores only token digests, the backend cannot reproduce
the same raw access and refresh tokens. Replaying the consumed WebAuthn response
must not issue a replacement session.

The eventual recovery flow is:

1. check `GET /auth/session`;
2. treat `200` as successful completion; and
3. if no usable access session reached the browser, authenticate using the
   newly created passkey.

Passkey authentication is the immediately following slice, so production
enablement of registration remains blocked until that recovery route exists.
This registration slice does not weaken one-time challenge or token handling to
hide the limitation.

## Architecture and Data Flow

### Layer responsibilities

- **Presentation** validates the HTTP wire format, extracts and clears cookies,
  validates exact origin, maps errors/statuses, sets `no-store`, and maps
  application values to shared contracts.
- **Application** coordinates enrollment eligibility, WebAuthn option policy,
  challenge lifecycle, verification, user creation inputs, session clocks, and
  notification requests through ports.
- **Infrastructure** implements PostgreSQL transactions, SimpleWebAuthn,
  cryptographic randomness/digests, cookie-independent token generation,
  security-event persistence, and email delivery.
- **Domain** represents the passwordless user and passkey invariants without
  depending on HTTP, PostgreSQL, or SimpleWebAuthn.

### Keep enrollment authorization and registration separate

Do not add WebAuthn preparation behavior to
`ISignupEnrollmentAuthorizationRepository`. That repository remains responsible
for issuing the limited authorization after verified email OTP.

Add a ceremony-oriented port such as:

```ts
interface ISignupPasskeyRegistrationRepository {
  prepareRegistration(
    input: PrepareSignupPasskeyRegistration,
  ): Promise<PreparedSignupPasskeyRegistration>;

  completeRegistration(
    input: CompleteSignupPasskeyRegistration,
  ): Promise<CompleteSignupPasskeyRegistrationResult>;
}
```

This repository owns the necessary cross-table transactions. It is not a
general passkey repository and does not absorb recovery or credential
management in this slice.

The enrollment and ceremony records are connected by:

- the cookie token digest used to locate the active authorization;
- the enrollment authorization ID stored on the challenge;
- the stable WebAuthn user handle assigned to that enrollment; and
- the purpose `signup-passkey-registration`.

The raw enrollment token and raw challenge are never persisted.

### Options flow

1. Presentation reads the environment-specific enrollment cookie and validates
   the exact `Origin`.
2. The application hashes the cookie value and generates:
   - a candidate 32-byte user handle; and
   - a fresh 32-byte WebAuthn challenge.
3. `prepareRegistration()` opens one PostgreSQL transaction that:
   - locks and validates the active cookie-bound enrollment by token digest;
   - assigns the candidate user handle only when the record has none;
   - reuses the existing handle otherwise;
   - enforces the persisted options-request limit;
   - invalidates the previous active signup-registration challenge; and
   - inserts the new challenge digest bound to the enrollment ID and purpose.
4. The repository returns the stable user handle, verified email display data,
   and fixed expiry.
5. The WebAuthn port creates `PublicKeyCredentialCreationOptionsJSON` using the
   stable handle and raw challenge.
6. Presentation returns those options and discards the raw challenge.

### Verification flow

1. Presentation validates the cookie, exact origin, wrapper, and WebAuthn JSON
   shape.
2. The application resolves the active enrollment and challenge using the
   enrollment token digest and the response challenge digest.
3. The WebAuthn port calls `verifyRegistrationResponse()` with:
   - the stored challenge binding;
   - the exact configured origin and RP ID;
   - ceremony type `webauthn.create`;
   - required user presence and user verification; and
   - the configured supported algorithm list.
4. Failed verification records one failed attempt and returns the generic `400`
   without consuming the enrollment authorization.
5. Successful verification creates raw access and refresh tokens in memory,
   then calls `completeRegistration()`.
6. One repository-owned transaction conditionally consumes the active
   challenge and enrollment and inserts the user, passkey, family, refresh
   generation, access session, and security event.
7. Only after commit does presentation clear the enrollment cookie and set the
   new access and refresh cookies.
8. A passkey-added security notification is sent after commit. Delivery failure
   does not roll back or misreport registration and is recorded without
   credential material.

## User Handle Decision

The WebAuthn user handle is an opaque stable byte sequence. Generate it on the
backend as 32 cryptographically random bytes and store the canonical base64url
form:

```ts
const userHandleBytes = randomBytes(32);
const storedUserHandle = userHandleBytes.toString("base64url");
```

Convert the stored value back to bytes when generating registration options:

```ts
const userID = Buffer.from(storedUserHandle, "base64url");
```

`crypto.randomUUID()` would be valid and provides sufficient randomness, but a
32-byte value is preferred because it directly matches WebAuthn's byte-oriented
model, provides 256 bits of randomness, and avoids UUID string-versus-binary
encoding ambiguity.

The handle:

- is generated once during the first successful options preparation;
- is reused across option and authenticator retries;
- becomes the account's permanent WebAuthn handle;
- is never generated by the browser;
- is never derived from email or another piece of PII; and
- is distinct from the internal user primary key and every credential ID.

## Persistence Model

### WebAuthn challenges

Add a purpose-capable challenge table with fields equivalent to:

```text
id                              uuid primary key
enrollment_authorization_id     uuid foreign key
purpose                         varchar
challenge_digest                varchar unique
attempt_count                   integer
max_attempts                    integer
created_at                      timestamptz
expires_at                      timestamptz
consumed_at                     timestamptz null
invalidated_at                  timestamptz null
```

- Purpose is exactly `signup-passkey-registration` for this slice.
- Expiry is capped by the enrollment authorization's fixed expiry.
- Store only the digest of the base64url challenge.
- Enforce no more than five options requests per enrollment and five failed
  verification attempts per challenge in PostgreSQL so limits work across
  replicas.

### Users

Add a nullable, unique `webauthn_user_handle` column to preserve compatibility
with existing legacy users. New passkey-signup users always receive a value.

Add a domain factory for passkey signup that creates a user with:

- the normalized verified recovery email;
- `passwordHash: null`;
- `emailVerifiedAt` equal to completion time;
- the stable WebAuthn user handle;
- the default free tier; and
- deterministic injected timestamps for testing.

### Passkey credentials

Add a dedicated `passkey_credentials` table:

```text
id                    uuid primary key
user_id               uuid foreign key references users(id) on delete cascade
credential_id         text not null unique
public_key            bytea not null
algorithm             integer not null
transports            text[] not null default '{}'
signature_counter     bigint not null
aaguid                 uuid not null
backup_eligible       boolean not null
backup_state          boolean not null
created_at            timestamptz not null
last_used_at           timestamptz null
revoked_at             timestamptz null
```

Field semantics:

- `credential_id` is the authenticator-generated, canonical base64url
  identifier used to locate this credential during authentication. It is not a
  user ID or secret.
- `public_key` is the verified binary `COSE_Key` returned by SimpleWebAuthn.
  COSE is the CBOR Object Signing and Encryption representation used by
  WebAuthn. Store the returned bytes directly as PostgreSQL `bytea`; never
  convert them to JSON or store a private key.
- `algorithm` is the verified COSE algorithm identifier, such as `-7` for
  ES256, `-8` for EdDSA, or `-257` for RS256. The value also exists inside the
  COSE key, but a separate column supports auditing and future algorithm
  deprecation. Extract it from the server-verified COSE key, not an untrusted
  client field.
- `transports` contains advisory browser/authenticator communication hints such
  as `internal`, `usb`, `nfc`, `ble`, `hybrid`, or `smart-card`. They are not an
  authorization property and may change over time.
- `signature_counter` starts at the verified registration counter and is
  updated after authentication. Counter anomalies are risk signals, not an
  unconditional rejection, because synced passkeys may report zero or
  non-monotonic values.
- `aaguid` is the 16-byte Authenticator Attestation GUID identifying an
  authenticator model/class. Because this flow requests `attestation: "none"`,
  it is diagnostic metadata rather than trusted hardware provenance; the
  all-zero AAGUID is valid.
- `backup_eligible` maps the WebAuthn BE flag. `false` means single-device;
  `true` means the credential is allowed to be backed up or synced and is a
  multi-device credential. Eligibility is fixed for the credential.
- `backup_state` maps the WebAuthn BS flag and records whether an eligible
  credential is currently backed up. It may change after later authentications.
  `backup_eligible = false` with `backup_state = true` is invalid and must be
  rejected.
- `last_used_at` is initially `null`; `revoked_at` enables soft revocation and
  preserves security history.

### Remembered-device and session state

Add the minimum ADR-0002 state required by signup:

- `remembered_device_families` with user ID, creation/last-use timestamps,
  seven-day inactivity expiry, fixed 30-day absolute expiry, current refresh
  generation, recent passkey-authentication time/purpose, authentication
  method, and nullable revocation fields.
- `refresh_token_generations` with family ID, generation, unique token digest,
  nullable parent/replacement relationships, creation/expiry, consumption, and
  revocation state. Signup creates generation zero.
- Evolve the existing `sessions` table with a nullable family relationship and
  replacement metadata so legacy rows remain readable during migration. New
  signup sessions always reference the new family.

At signup:

- access inactivity expiry is `now + 30 minutes`;
- access absolute expiry is `min(now + 8 hours, family.absoluteExpiry)`;
- family inactivity expiry is `now + 7 days`;
- family absolute expiry is `now + 30 days`; and
- the signup passkey ceremony records recent passkey authentication for the new
  family with purpose `signup`.

Generate raw access and refresh values with at least 256 bits of cryptographic
randomness. Persist only digests and retain raw values only until presentation
sets the response cookies.

## Cookie and Request Security

### Enrollment cookie

- Read the existing production `__Secure-passkey-enrollment` or localhost
  `passkey-enrollment` cookie from the registration path.
- Clear it on successful completion and terminal authorization failure using
  exactly the same name, path, `Secure`, `HttpOnly`, and `SameSite` attributes.
- Do not add a cookie-parsing dependency. Add a narrow, tested cookie extractor
  that matches exact names, handles decoding failure safely, and never logs
  values.

### Access cookie

- Production name uses the `__Host-` prefix.
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Localhost uses a distinct unprefixed name and omits `Secure` only for HTTP
  local development.
- Expiry is no later than the server-side access inactivity expiry.

### Refresh cookie

- Production name uses the `__Secure-` prefix.
- `HttpOnly`, `Secure`, `SameSite=Strict`, no `Domain`, and
  `Path=/api/v1/auth/session`.
- When `rememberDevice` is `true`, browser expiry is capped by both family
  limits.
- When `rememberDevice` is `false`, omit `Expires` and `Max-Age`; the server-side
  family limits still apply.

### Origin and WebAuthn configuration

Add validated configuration for:

- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `WEBAUTHN_RP_NAME`

Local defaults are `localhost`, `http://localhost:3000`, and `Calibrate`.
Production requires explicit values and a stable canonical custom domain.

Both cookie-authorized registration endpoints reject missing, `null`, malformed,
or unexpected `Origin` values before reading or changing ceremony state.

## Frontend Behavior

Upgrade the existing passkey-enrollment page rather than creating a parallel
route. The active state contains:

- a primary **Create passkey** action;
- a **Keep me signed in on this device** choice, checked by default;
- explanatory shared-device copy;
- an accessible pending state while options, authenticator UI, and verification
  run;
- a non-destructive cancellation/timeout state with **Try again**;
- unsupported-browser guidance;
- enrollment-expired guidance with **Start again**;
- rate-limit messaging that respects `Retry-After`; and
- a generic safe verification or availability failure.

Wrap `@simplewebauthn/browser` behind a small injected browser-registration
adapter so component and integration tests never require a physical
authenticator.

On success, seed the authenticated-user client state from
`AuthenticatedSessionResponse` and navigate to the application root. Browser
code never reads, copies, or stores any `HttpOnly` credential.

## Atomicity and Failure Semantics

`completeRegistration()` owns one PostgreSQL transaction that:

1. locks the active enrollment and challenge;
2. conditionally consumes both exactly once;
3. verifies that email and user-handle uniqueness still hold;
4. inserts the passwordless user;
5. inserts the globally unique passkey credential;
6. inserts the remembered-device family;
7. inserts refresh generation zero using only its digest;
8. inserts the access session using only its digest; and
9. inserts the signup/passkey-added security event.

Any failure rolls back the whole operation. Concurrent verification of the same
challenge permits exactly one commit. Duplicate email, credential ID, stale
challenge, or lost conditional consumption returns a safe conflict/failure and
never leaks whether another account or credential exists.

Cryptographic verification occurs before this transaction, but the conditional
consumption inside the transaction is the final authority. A response verified
concurrently does not gain permission to commit after another request consumes
the state.

## Implementation Tasks

### Story and branch setup

- [ ] Create the story integration branch
  `codex/passkeys-sign-up-after-enrollment-authorization` before implementation.
- [ ] Create one focused subtask branch per task below, branching from the story
  integration branch unless an unmerged dependency requires otherwise.
- [ ] Inspect each diff before committing or opening a PR and confirm it contains
  only the intended subtask/gate scope.

### Task 1: Shared API contracts

Add strict schemas and exported types for options, verification input,
authenticated success, and safe failures.

**Acceptance:**

- [ ] Valid SimpleWebAuthn v13 JSON passes without allowing unknown top-level
  registration fields accidentally.
- [ ] Invalid base64url, credential type, wrapper, and `rememberDevice` values
  fail validation.
- [ ] Success and error schemas contain no raw credential-token field.

**Verify:**

```sh
npx nx run @calibrate/api-contracts:test
```

Open the required API-contract PR to the story integration branch immediately
after this task.

### Task 2: WebAuthn application ports and policy service

Add application DTOs, the WebAuthn registration port, signup registration
service, explicit option policy, error/result types, and focused unit tests.

**Acceptance:**

- [ ] Application code does not import SimpleWebAuthn or PostgreSQL.
- [ ] Options always require discoverability and user verification, use no
  attestation, and omit attachment restriction.
- [ ] Verification maps all library/cryptographic detail to safe application
  outcomes.

**Verify:**

```sh
npx nx run backend:test
```

### Task 3: Registration persistence schema

Add migrations and Kysely types for challenges, user handles, passkey
credentials, remembered-device families, refresh generations, access-session
family linkage, and security events. Update the integration cleanup harness.

**Acceptance:**

- [ ] Unique constraints protect token digests, user handles, and credential
  IDs.
- [ ] Foreign keys and deletion behavior preserve account/passkey consistency.
- [ ] Legacy users and session rows remain valid after migration.

**Verify:**

```sh
npx nx run backend:test:integration
```

### Task 4: Atomic registration preparation

Implement `ISignupPasskeyRegistrationRepository.prepareRegistration()` and its
PostgreSQL adapter.

**Acceptance:**

- [ ] Valid authorization receives one stable 32-byte user handle.
- [ ] Repeated and concurrent options requests retain that handle while only
  one latest challenge remains active.
- [ ] Expiry never slides, raw challenge/token values are absent from storage,
  and persisted request limits are enforced.

**Verify:**

```sh
npx nx run backend:test:integration
```

### Task 5: SimpleWebAuthn registration adapter

Implement option generation and response verification using
`@simplewebauthn/server` with validated RP configuration.

**Acceptance:**

- [ ] A valid deterministic registration vector returns credential ID, COSE
  public key, verified algorithm, transports, counter, AAGUID, and backup flags.
- [ ] Wrong challenge, origin, RP ID, ceremony type, algorithm, presence, or
  user verification fails safely.
- [ ] No library error or credential material reaches client-visible errors or
  logs.

**Verify:**

```sh
npx nx run backend:test
```

### Task 6: Atomic signup and session issuance

Implement `completeRegistration()` plus token/family clock creation and
passwordless user/passkey persistence.

**Acceptance:**

- [ ] One transaction creates every required record and consumes both limited
  states.
- [ ] Any failed insert or conditional update rolls back all records.
- [ ] Concurrent completion yields exactly one user/passkey/family and raw
  access/refresh values never reach PostgreSQL.

**Verify:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
```

### Checkpoint: Backend application and persistence

- [ ] Tasks 2-6 focused tests pass.
- [ ] Migrations apply to the isolated integration database.
- [ ] Review transaction boundaries, secret handling, and schema constraints
  before adding HTTP behavior.

### Task 7: Backend HTTP routes, cookies, and access middleware

Add both controller actions and routes, origin validation, narrow cookie
extraction, cookie set/clear helpers, container wiring, and new access-cookie
validation while preserving legacy bearer behavior.

**Acceptance:**

- [ ] Both endpoints match the shared contract and use `no-store`.
- [ ] Exact origin and every cookie attribute are enforced for production and
  localhost variants.
- [ ] A successful verification can immediately call a protected endpoint with
  the issued access cookie.

**Verify:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

Open the backend gate PR to the story integration branch after Tasks 2-7 are
complete and the diff contains only backend scope.

### Task 8: API-client mutations

Add registration-options and verification operations plus mutation helpers.

**Acceptance:**

- [ ] Both requests use `credentials: "include"` through the shared transport.
- [ ] Verification explicitly sets `retry: false`.
- [ ] Client tests prove the verify payload cannot be silently replayed by the
  helper and error codes remain available for UI classification.

**Verify:**

```sh
npx nx run @calibrate/api-client:test
npx nx run @calibrate/api-client:typecheck
```

### Task 9: Browser ceremony and enrollment UI

Wire the existing page through the injected browser adapter, both API
mutations, remembered-device selection, safe retry orchestration, and success
navigation.

**Acceptance:**

- [ ] A successful click runs options, authenticator creation, and verification
  exactly once.
- [ ] **Try again** always requests fresh options and never resubmits an old
  credential response.
- [ ] Pending, cancellation, unsupported, expired, rate-limited, ambiguous, and
  generic failure states are accessible and keyboard-operable.

**Verify:**

```sh
npx nx run web:test
npx nx run web:typecheck
```

### Task 10: Full vertical integration and documentation check

Exercise the email-verification handoff through passkey signup using a fake
email sender and deterministic WebAuthn test adapter; confirm documentation and
ADR terminology remain aligned.

**Acceptance:**

- [ ] The HTTP flow proves email OTP verification, enrollment-cookie delivery,
  options, verification, atomic database state, cookie replacement, and access
  to a protected resource.
- [ ] Replay, race, expiry, exact-origin, raw-secret absence, and cookie clearing
  scenarios pass.
- [ ] The known ambiguous-completion limitation and production feature gate are
  visible in handoff/release documentation.

**Verify:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
npx nx run web:test
npx nx run web:typecheck
```

Open the frontend/backend wiring PR to the story integration branch after this
task.

## Test Scenarios

### Contract and API client

- Valid options and registration response round trips.
- Malformed base64url, strict-object violations, and invalid transports.
- Metadata-only authenticated success.
- Exact paths, methods, bodies, and credentialed transport.
- Explicit absence of automatic mutation retries.

### Application and WebAuthn adapter

- First and repeated options calls use the same handle but different challenge.
- User handle remains opaque, 32 bytes, stable, and unrelated to email.
- Challenge expiry is capped by authorization expiry.
- Valid registration with supported synced and single-device credentials.
- Wrong challenge, origin, RP ID, type, signature, algorithm, presence, or user
  verification.
- Valid and invalid BE/BS combinations.
- Library failures are reduced to generic application errors.

### Repository integration

- Registration preparation is atomic under concurrent option requests.
- Raw enrollment token, challenge, access token, and refresh token are absent
  from all rows.
- Options and verification limits are enforced across repository instances.
- Successful completion creates exactly one consistent record set.
- Duplicate email or credential ID and injected insert failures roll back.
- Concurrent verification yields one success and one safe conflict.
- Consumed, expired, invalidated, or wrong-purpose state cannot complete signup.

### HTTP integration

- Missing, `null`, malformed, and unexpected origins fail before state changes.
- Missing, malformed, expired, consumed, and invalidated cookies fail safely.
- Production and localhost cookie names, paths, flags, expiry, and clearing
  match their centralized configurations.
- JSON bodies and captured logs contain no raw credential values.
- Successful access cookie authorizes a protected request.
- Replay and duplicate submissions issue no additional credentials.
- Responses use `Cache-Control: no-store`.

### Web UI

- Successful end-to-end orchestration and navigation.
- Remember-device checked and unchecked behavior.
- Disabled duplicate submission while pending.
- Authenticator cancellation and timeout offer a fresh-ceremony retry.
- `400`, `401`, `403`, `409`, `429`, `5xx`, and network failures map to the
  intended UI state without automatic replay.
- Expired handoff returns the user to email verification.
- All interactive controls are keyboard accessible and announced correctly.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A successful verification response is lost | User exists but browser may not receive sessions | Never replay; require session check then passkey login. Keep production disabled until that following slice exists. |
| Concurrent option or verify calls race | Mismatched challenge/handle or duplicate account state | Row locking and conditional writes in ceremony-owned transactions. |
| Credential fields are trusted from client JSON | Forged metadata or unusable stored key | Persist only values returned by successful server-side WebAuthn verification. |
| Synced passkey counters do not increase | False clone detection | Treat counters as a risk signal according to ADR-0002, not an unconditional failure. |
| AAGUID is mistaken for trusted hardware identity | Incorrect assurance claims | Attestation remains `none`; document AAGUID as diagnostic metadata only. |
| Cookie authentication is enabled prematurely | CSRF, leakage, or deployment-boundary exposure | Default production feature off and require the complete ADR-0002 shipping gate. |
| Notification delivery fails after commit | User is registered without immediate email notice | Do not roll back authentication; record delivery failure safely for operational follow-up. |

## Assumptions and Defaults

- The browser is the only enrollment transport implemented in this slice.
- `rememberDevice` defaults to `true`; the user can explicitly opt out on a
  shared device.
- Five options requests per enrollment and five failed verification attempts
  per challenge are the initial persisted limits.
- The installed SimpleWebAuthn v13 server/browser dependencies are used; no new
  dependency is required.
- Initial supported algorithms follow the installed SimpleWebAuthn defaults
  unless a narrower existing backend policy is discovered during
  implementation.
- Initial passkey creation counts as recent passkey authentication for the new
  remembered-device family with purpose `signup`.
- Passkey login is the next required authentication slice and is a production
  prerequisite because it resolves ambiguous registration completion.

## Agent handoff

Active implementation notes, Cursor sandbox behavior for Docker integration
tests, and continuation state live in
[`003-agent-handoff.md`](./003-agent-handoff.md). Agents continuing this story
should read that file first — especially the requirement to request
`full_network` and ask the user to approve when running
`backend:test:integration`.
