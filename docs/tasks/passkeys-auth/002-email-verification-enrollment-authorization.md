# Implementation Plan: Email Verification and Enrollment Authorization

## Goal

Implement the smallest complete vertical slice for:

1. A user submits a six-digit signup email verification code to
   `POST /api/v1/auth/email-verification/verify`.
2. The backend verifies and atomically consumes the email OTP challenge.
3. The backend creates a short-lived, limited authorization to continue into
   passkey enrollment.
4. A web client receives that authorization only as a dedicated `HttpOnly`
   cookie and navigates to the passkey-enrollment step.

This slice stops before WebAuthn registration options, registration
verification, user creation, and access/refresh session issuance. It establishes
the authorization that those later steps will consume.

The implementation must follow
[ADR 0002: Email OTP and Cookie-Backed Server Sessions](../../../apps/backend/docs/adr/0002-email-otp-and-cookie-backed-server-sessions.md).
The ADR should be amended where this passkey-first signup flow intentionally
supersedes its earlier assumption that successful OTP verification immediately
creates a user session.

## Accepted Architecture Decisions

### Preserve the signup challenge's client binding

Keep `sessionTransport` and `mobilePlatform` on the email OTP challenge and copy
them to the enrollment authorization.

At verification time, the request's client classification must match the
classification recorded when the challenge was created:

- No platform header means the web `cookie` transport.
- `X-App-Platform: ios` means the native `bearer` transport with platform
  `ios`.
- `X-App-Platform: android` means the native `bearer` transport with platform
  `android`.
- Unknown platform values continue to fail request validation.

This prevents a challenge requested for one client flow from silently changing
to another flow during verification. A platform mismatch returns the same
generic invalid-or-expired verification error as other invalid challenges, but
does not increment the OTP guess count because no code comparison occurred.

This binding proves continuity of the declared client type, not continuity of a
specific physical device or browser. Headers are spoofable. If a later
requirement needs proof that the same installation or browser continues the
flow, add a separate high-entropy continuation secret rather than treating the
platform header as device identity.

### Use a dedicated web enrollment cookie

For the web client, the raw enrollment authorization is returned only in a
short-lived `HttpOnly` cookie. The JSON body contains non-secret workflow
metadata only.

Production cookie:

```http
Set-Cookie: __Secure-passkey-enrollment=<opaque-random-secret>;
  HttpOnly;
  Secure;
  SameSite=Strict;
  Path=/api/v1/auth/passkeys/registration;
  Max-Age=300
```

Additional response requirements:

```http
Cache-Control: no-store
Content-Type: application/json
```

Do not set a `Domain` attribute. Local HTTP development uses a distinct,
unprefixed cookie name with `Secure` disabled; it must not weaken the production
cookie configuration.

Only the web cookie presentation is implemented in this slice. The application
and persistence model retain the transport/platform binding so a later native
credential-delivery design can be added without changing the authorization's
security semantics.

### Keep the enrollment lifetime fixed

An enrollment authorization expires exactly five minutes after successful OTP
verification.

- Requesting or resending an OTP does not extend or invalidate an already
  issued enrollment authorization.
- A new successful OTP verification creates a new five-minute authorization and
  invalidates older unconsumed authorizations for the same normalized email and
  client binding.
- Calling the future passkey registration-options endpoint does not slide or
  extend the authorization expiration.

For example, if an authorization is issued at `T+0` and the user requests
another OTP at `T+3`, the existing authorization still expires at `T+5`.
Extending it merely because another code was requested would let unauthenticated
activity prolong a previously earned privilege. A newly verified OTP may
legitimately establish a fresh five-minute authorization.

### Assign the WebAuthn user handle lazily

The enrollment authorization record includes a nullable, unique
`webauthn_user_handle`, but OTP verification initially stores `null`.

The future `POST /api/v1/auth/passkeys/registration/options` operation will
atomically assign a cryptographically random user handle when it is first
needed. It will reuse that handle for retries under the same authorization.
Successful registration will copy the handle to the new user.

This keeps the current slice focused on email verification while giving the
future WebAuthn ceremony a stable, server-owned user handle. The handle is not
derived from the email address and is not exposed as an enrollment credential.

## Existing Code Assessment

### Reuse without changing its security behavior

- `NodeEmailOtpCodeService.verifyChallenge()` already recomputes the
  purpose-bound HMAC and uses timing-safe comparison. Reuse it for the six-digit
  verification code.
- The existing signup challenge purpose,
  `signup-email-verification`, remains the purpose passed to code verification.
- `IEmailOtpChallengeRepository.findById()` remains useful for loading the
  challenge before verification.
- Existing challenge fields for `sessionTransport` and `mobilePlatform` remain
  part of the flow.
- The existing request/resend flow remains responsible for creating and sending
  challenges. It does not issue or renew enrollment authorizations.

### Adapt existing code

- Extend the shared API contracts with the verify request and metadata-only
  response.
- Extend `ISignupEmailVerificationService` and
  `SignupEmailVerificationServiceImpl` with a verification operation, or rename
  the service to an email-verification name if both request and verify behavior
  make the current signup-request-oriented name misleading.
- Reuse `recordFailedAttempt()` only for a submitted code that reaches code
  comparison and is incorrect. Strengthen its persistence semantics if needed
  so attempt limits remain correct under concurrent requests.
- Generalize `ISessionTokenService` and `NodeSessionTokenService` to an
  enrollment-neutral opaque-secret service, such as `IOpaqueTokenService` and
  `NodeOpaqueTokenService`. Their current 32-byte random token plus SHA-256
  digest implementation is suitable; the session-specific names are not.
- Extend the controller, route wiring, dependency container, and web API client
  around the new operation while preserving their current layer boundaries.

### Write new code

- A signup enrollment authorization application/persistence model.
- A repository operation that atomically consumes a valid OTP challenge and
  creates the enrollment authorization.
- Database migration and Kysely table typing for enrollment authorizations.
- Cookie configuration dedicated to passkey enrollment.
- The verify request mutation and OTP-submit behavior in the web client.
- Navigation and a minimal passkey-enrollment destination screen.

### Do not plan around removed code

`consumeAndCreateSession` does not exist on the current branch. It was historical
session-era code and must not be described as a current method to rename or
replace.

Implement a new transaction-shaped operation, for example
`consumeAndCreateEnrollmentAuthorization`. Historical code may be consulted only
as a reference for transaction and compare-and-set patterns; its session
creation behavior is not part of this flow.

## API Contract

### Request

```http
POST /api/v1/auth/email-verification/verify
Content-Type: application/json
```

```json
{
  "challengeId": "<public-challenge-id>",
  "code": "123456"
}
```

Shared validation requirements:

- `challengeId` is a non-empty string in the existing public challenge-ID
  format.
- `code` is exactly six ASCII digits.
- The platform header is parsed through the same client-classification logic as
  the request/resend endpoint.

### Successful web response

```http
HTTP/1.1 200 OK
Set-Cookie: __Secure-passkey-enrollment=<opaque-random-secret>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/passkeys/registration; Max-Age=300
Cache-Control: no-store
Content-Type: application/json
```

```json
{
  "next": "passkey-registration",
  "expiresAt": "2030-01-01T00:05:00.000Z"
}
```

The response must not contain:

- The raw enrollment authorization.
- Its digest.
- The OTP.
- A WebAuthn user handle.
- A user, access token, refresh token, or session token.

### Failure behavior

- Invalid request shape returns the existing validation-error response.
- Unknown, expired, invalidated, consumed, exhausted, incorrectly bound, or
  incorrectly coded challenges return one generic invalid-or-expired-code
  response.
- Infrastructure failure returns the existing non-sensitive service error.
- Every verification response includes `Cache-Control: no-store`.
- Logs and telemetry may record non-secret identifiers and outcome categories,
  but never the OTP or raw enrollment token.

## Application Flow

Add a verification operation with dependencies on:

- `IEmailOtpChallengeRepository`.
- `IEmailOtpCodeService`.
- The new signup enrollment authorization repository.
- The generalized opaque-token service.
- `IClock`.

The operation performs the following:

1. Normalize and classify the request client using the same presentation logic
   used when the challenge was requested.
2. Load the challenge by ID.
3. Reject it generically unless all non-secret eligibility checks pass:
   - Purpose is `signup-email-verification`.
   - It is not expired, invalidated, consumed, or attempt-exhausted.
   - Its `sessionTransport` and `mobilePlatform` match the current request.
4. Verify the submitted six-digit code with
   `NodeEmailOtpCodeService.verifyChallenge()`.
5. If the code is incorrect, atomically record the failed attempt and return the
   generic verification error.
6. Generate at least 256 bits of cryptographically secure randomness for the
   enrollment token. Retain the raw token only long enough to present it to the
   client, and persist only its digest.
7. In one database transaction:
   - Conditionally consume the still-valid, still-unconsumed challenge.
   - Invalidate older unconsumed enrollment authorizations for the same email,
     `sessionTransport`, and `mobilePlatform`.
   - Insert the new enrollment authorization with a fixed five-minute
     expiration and a null WebAuthn user handle.
8. Return the raw token and non-secret expiration metadata to the presentation
   layer.
9. The web controller sets the dedicated enrollment cookie and returns only
   `{ "next": "passkey-registration", "expiresAt": "..." }`.

If conditional challenge consumption affects no row, the operation loses a
race and must return the generic verification error without creating an
authorization.

## Persistence Design

Add a `signup_enrollment_authorizations` table with fields equivalent to:

- `id`: public/internal authorization identifier.
- `email`: normalized signup email.
- `token_digest`: digest of the opaque enrollment secret; unique.
- `session_transport`: copied from the verified challenge.
- `mobile_platform`: nullable, copied from the verified challenge.
- `webauthn_user_handle`: nullable and unique when present.
- `created_at`.
- `expires_at`.
- `consumed_at`: nullable.
- `invalidated_at`: nullable.

Add indexes that support:

- Token-digest lookup for future registration endpoints.
- Invalidating active authorizations by email and client binding.
- Retention cleanup by expiration/consumption time.

The repository owns the transaction boundary in accordance with the backend
clean-architecture ADRs. The application service owns workflow policy; SQL,
locking, and conditional updates remain infrastructure concerns.

The transaction must preserve these invariants under concurrency:

- One OTP challenge can create at most one enrollment authorization.
- A failed concurrent consume cannot leave an orphan authorization.
- A newly successful verification invalidates older authorizations only for the
  same email and client binding.
- Raw tokens are never stored.

## Web Presentation and Browser Behavior

### Backend presentation

- Add `POST /auth/email-verification/verify` to the existing auth router; the
  application mounts it under `/api/v1`.
- Validate the body with the shared Zod schema.
- Reuse the current request client-classification rules for the platform header.
- Set the environment-specific enrollment cookie from one centralized cookie
  configuration.
- Set `Cache-Control: no-store`.
- In local web development, allow credentialed CORS only from the exact
  configured frontend origin and use `localhost` consistently.

### Shared API client and frontend

- Add a verify-email operation that posts the challenge ID and six-digit code.
- Ensure the web transport uses `credentials: "include"` so the browser accepts
  and later sends the enrollment cookie.
- Extend the existing OTP page with:
  - A six-digit code input.
  - Submit/loading behavior.
  - Accessible validation feedback.
  - A generic invalid-or-expired-code state.
  - Existing resend behavior without implying that resend extends an enrollment
    authorization.
- On success, navigate to `/auth/passkey-enrollment`.
- Carry only non-secret workflow state such as email, `next`, and `expiresAt`.
  The enrollment credential stays inaccessible to JavaScript in the
  `HttpOnly` cookie.
- Add a minimal passkey-enrollment route/page that can display the next step and
  an expired-workflow recovery path. Actual WebAuthn calls are deferred.

## Contract for the Follow-Up Passkey Slice

The cookie path intentionally limits the credential to:

```text
/api/v1/auth/passkeys/registration
```

The later passkey slice will implement:

1. `POST .../registration/options`
   - Receives the enrollment cookie automatically.
   - Looks up the authorization by token digest.
   - Rejects expired, consumed, invalidated, or incorrectly bound
     authorizations.
   - Atomically assigns or reuses the WebAuthn user handle.
   - Creates WebAuthn options and binds the resulting challenge to the
     enrollment authorization.
   - Does not extend the authorization expiration.
2. `POST .../registration/verify`
   - Receives the same cookie.
   - Verifies the WebAuthn response and all stored challenge bindings.
   - Atomically consumes both the WebAuthn challenge and enrollment
     authorization while creating the user, passkey, and authenticated
     session.
   - Expires the enrollment cookie on success.
   - Sets the new access and refresh cookies.

These endpoints are design constraints for the current authorization schema,
but their implementation is out of scope for this slice.

## Test Plan

### Shared contract tests

- Accept a valid challenge ID and exactly six ASCII digits.
- Reject codes with the wrong length, whitespace, signs, decimal characters, or
  non-ASCII digits.
- Accept only the exact success discriminator
  `next: "passkey-registration"` and an ISO timestamp.
- Prove the success schema contains no enrollment-token field.

### Application service tests

- Correct code creates an authorization with the expected email, binding,
  token digest, null WebAuthn user handle, and five-minute expiration.
- The raw token is returned only to the presentation boundary and is different
  from its persisted digest.
- Unknown, expired, invalidated, consumed, and exhausted challenges fail
  generically.
- Incorrect codes call `recordFailedAttempt()`.
- Client-binding mismatches fail generically without incrementing the OTP guess
  count.
- A repository race that loses conditional consumption does not return an
  authorization.
- Requesting or resending an OTP does not alter an existing enrollment
  authorization.
- A later successful verification invalidates older authorizations for the same
  email and client binding, but not authorizations for a different binding.

### Security adapter tests

- Preserve the existing OTP HMAC and timing-safe verification tests.
- Rename/generalize the token-service tests while preserving assertions for
  cryptographically random 32-byte tokens and deterministic digests.
- Assert separate generated tokens do not collide in the tested sample.

### Repository integration tests

- Successful consume-and-create is atomic.
- Concurrent verification of one challenge creates at most one authorization.
- Stored authorization data contains a token digest but not the raw token.
- Failed attempts remain bounded under concurrency.
- Invalidation scope includes normalized email, transport, and nullable
  platform.
- Expired and already-consumed challenges cannot create authorizations.
- The nullable WebAuthn user handle accepts `null` and enforces uniqueness when
  populated.

### HTTP integration tests

No real email account or external email provider is required.

- Build the test application with an in-memory/fake `IEmailSender`.
- Call the email-verification request endpoint.
- Read the generated OTP from the fake sender's captured message in test memory.
- Submit that captured code to the verify endpoint.
- Assert `200`, `Cache-Control: no-store`, the metadata-only JSON body, and the
  enrollment `Set-Cookie` attributes.
- Assert the JSON body and logs do not contain the raw cookie secret.
- Cover invalid code, expired challenge, exhausted attempts, replay, and client
  binding mismatch through the same local test seam.

This exercises request, OTP delivery, and verification through the real local
HTTP/application/persistence boundaries while replacing only the external email
delivery adapter.

### Web component and browser-facing integration tests

Keep browser automation independent of a real inbox:

- For OTP-page component tests, inject/mock the API mutation with deterministic
  success and failure responses. Assert six-digit validation, pending state,
  generic errors, and navigation to `/auth/passkey-enrollment`.
- For the existing request-to-OTP-page integration test, continue using a
  contract-shaped local fetch handler. Extend it with a deterministic verify
  response and assert the request body, `credentials: "include"`, metadata
  handoff, and navigation.
- Do not attempt to read the `HttpOnly` token from frontend JavaScript. Backend
  HTTP integration tests own the exact `Set-Cookie` assertions; browser-facing
  tests assert only observable navigation and that credentialed fetch is used.
- If a full browser test is later added, run it against a local test backend
  whose fake email sender exposes the captured OTP to test code through an
  in-process fixture or test-only harness—not through a real mailbox or a
  production endpoint.

Sending through the production email provider and receiving mail in a real
inbox may be covered by a separate manual staging smoke test, but it is not a
requirement of the automated suite.

## Documentation Update

Amend ADR 0002 to record that, for new-user passkey signup:

- Successful OTP verification creates a limited enrollment authorization rather
  than an authenticated user session.
- The web enrollment credential uses its own five-minute `HttpOnly`,
  `SameSite=Strict`, path-scoped cookie.
- User creation and authenticated access/refresh cookies occur only after
  successful passkey registration.
- Existing OTP HMAC, one-time use, attempt-limit, generic-error, transport
  binding, origin, and secret-handling decisions continue to apply.

## Implementation Order

1. **ADR and shared API contracts**
   - Record the flow correction in ADR 0002.
   - Add verify request/response schemas and contract tests.
2. **Persistence model**
   - Add the enrollment authorization port, migration, Kysely types, repository,
     and repository integration tests.
3. **Security-service generalization**
   - Rename the session-specific opaque-token abstractions and preserve their
     implementation/tests.
4. **Application verification operation**
   - Implement eligibility checks, binding checks, OTP verification, attempt
     handling, and the atomic consume-and-create call.
5. **Backend presentation**
   - Add the controller/route, enrollment-cookie configuration, cache headers,
     dependency wiring, and HTTP integration tests using the fake email sender.
6. **Web client**
   - Add the API operation, OTP submission UI, metadata-only navigation, and
     minimal passkey-enrollment destination.
7. **Focused verification**
   - Run the smallest affected contract, backend service, repository
     integration, controller/route, API-client, and web component tests.
   - Broaden to the relevant Nx project test and typecheck targets after the
     focused tests pass.

The story branch and subtask branches/commits should follow the repository's
story and PR gates. Each numbered step above can be treated as a focused subtask
unless implementation discovery shows a smaller safe split.

## Out of Scope

- WebAuthn registration options generation.
- WebAuthn attestation/registration verification.
- User or passkey creation.
- Access/refresh session creation.
- Native iOS or Android enrollment-secret delivery.
- Proof that the same physical device or installation continued the flow.
- Production email-provider delivery tests in the automated test suite.
