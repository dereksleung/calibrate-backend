# Implementation Plan: Immediate Recovery Passkey with a Five-Day Security Restriction

## Outcome and scope

Implement the existing-account continuation from
[`007-unified-email-entry-and-post-otp-routing.md`](./007-unified-email-entry-and-post-otp-routing.md)
as a complete web login and recovery slice:

1. Verified email control issues a short-lived account-access authorization, not a session.
2. The user can immediately attempt identifier-first login with one of the account's existing
   passkeys.
3. If no existing passkey is usable, the user can explicitly start recovery and register a new
   passkey immediately.
4. That recovery-created passkey can authenticate and use ordinary account features immediately,
   but remains provisional for five server-timed days.
5. During those five days, the provisional passkey and every session derived from it cannot perform
   takeover-sensitive operations.
6. A pre-existing trusted passkey can cancel the recovery during the restriction period.
7. After five days, a fresh assertion from the provisional passkey promotes it to trusted, revokes
   all prior sessions and remembered-device families, and creates a replacement unrestricted
   family/session.

This is the smallest full slice ending in a fully promoted recovered credential. It excludes the
general credential-management UI, selective device management, recovery-email changes, additional
recovery factors, native-app transport, and support-agent recovery.

## Prerequisites

- Complete plan 007 through the `next: "login-or-recovery"` branch and placeholder route.
- Preserve usernameless passkey login from
  [`004-passkey-login-existing-credential.md`](./004-passkey-login-existing-credential.md).
- Preserve session creation/restoration from
  [`005-session-restoration.md`](./005-session-restoration.md).
- Reuse the existing SimpleWebAuthn adapters, opaque token service, session lifetime calculator,
  cookie helpers, and PostgreSQL transaction conventions. Add no dependency for this slice.

## Explicit security trade-off

This design protects against immediate persistent account takeover, not immediate account access.
An attacker who controls the recovery inbox can register a provisional passkey and immediately read
or modify anything classified as an ordinary authenticated operation. The five-day restriction
prevents that attacker from removing trusted passkeys, changing the recovery email, multiplying
credentials, revoking legitimate devices, deleting the account, exporting the complete data set, or
performing another takeover-sensitive operation.

For Calibrate's current consumer-wellness threat model, accepting immediate ordinary access is a
material reduction from a five-day pre-access delay. ADR-0003 must record this consciously. Before
shipping higher-impact financial, clinician, regulated, administrative, or bulk-export features,
revisit whether they are ordinary operations and whether immediate recovery access remains
acceptable.

Email remains the recovery assurance floor. The restriction period provides detection and
intervention time; it does not turn compromised email into phishing-resistant proof.

## Locked authority model

| Authority/state | Lifetime | May do | Must not do |
| --- | --- | --- | --- |
| Account-access authorization | 15 minutes, fixed | Read post-OTP status, perform account-bound passkey login, or authorize one recovery-registration ceremony | Call ordinary APIs, create a session without WebAuthn, register multiple passkeys, or change account data |
| Recovery-registration authorization | 15 minutes, fixed and single-purpose | Request and verify one new passkey registration for the bound account | Authenticate, call ordinary APIs, remove credentials, or survive successful registration |
| Provisional recovery passkey | Until cancelled or promoted; promotion eligible after five days | Authenticate and create restricted sessions | Satisfy takeover-sensitive authorization or cancel/promote itself before the trusted server time |
| Restricted recovery family/session | Existing session/family lifetimes, capped normally | Call ordinary authenticated APIs | Perform takeover-sensitive operations, even with a recent assertion from the provisional passkey |
| Promoted passkey/session | Normal credential/session lifecycle | Use ordinary APIs and, after fresh passkey authentication, sensitive operations | Bypass the normal recent-authentication rule |

All raw account-access and recovery-registration authorities are at least 256-bit opaque secrets.
Persist only SHA-256 digests. Web delivery uses `HttpOnly`, `Secure`, `SameSite=Strict`, host-only,
path-scoped cookies. JavaScript, URLs, router state, analytics, logs, traces, and response JSON never
receive the secrets.

## Locked recovery lifecycle

### 1. OTP verification issues account access

Extend plan 007's existing-account transaction:

- create a 15-minute account-access authorization bound to the resolved user, OTP challenge, and
  client transport;
- invalidate older unconsumed account-access authorizations for that user/binding;
- set the account-access cookie scoped to `/api/v1/auth/account-access`;
- return `next: "login-or-recovery"` and its expiry;
- create no access session and no recovery credential yet.

Successful account-bound login or recovery start consumes this authorization atomically.

### 2. Identifier-first passkey login remains the preferred path

The account-access status may reveal whether the verified account has active passkeys. The options
endpoint returns all and only that account's active credential IDs and transports in a required,
non-empty `allowCredentials` list.

- Never omit `allowCredentials` from the identified endpoint; omission would change it to
  usernameless discovery.
- Bind the challenge to the account-access authorization, user ID, purpose, and expiry.
- Accept only an active credential owned by that user.
- Require exact origin, RP ID, challenge, signature, user presence, user verification, one-time
  challenge use, counter policy, attempt limits, and shared rate limits.
- Browser cancellation or no local match leaves recovery as an explicit choice; it never starts
  recovery automatically.

If the selected credential is trusted, successful login cancels any active provisional recovery for
that account before issuing an unrestricted family/session. If it is the provisional recovery
credential, login issues only a restricted family/session.

### 3. Recovery registration is explicit and immediate

**I can't use a passkey** opens a confirmation screen. Only **Create a recovery passkey** consumes
account access and issues a 15-minute recovery-registration authorization.

The registration ceremony:

- uses the account's stable opaque WebAuthn user handle;
- requires a discoverable credential with `residentKey: "required"` and
  `userVerification: "required"`;
- uses attestation `none`;
- includes every active existing credential in `excludeCredentials`;
- caps options requests and verification attempts;
- rejects a credential ID already registered to any user;
- requires a fresh challenge for every retry.

The five-day clock starts only after successful server verification and persistence of the new
passkey. Merely verifying email, opening recovery, requesting options, or creating a browser-side
credential whose server verification fails does not age the restriction.

### 4. Provisional registration creates restricted access without displacing the owner

On successful recovery registration, one transaction:

1. consumes the WebAuthn challenge and recovery-registration authorization;
2. creates an account-recovery record with
   `restrictionEndsAt = registeredAt + 5 days`;
3. inserts the passkey bound to that recovery as provisional;
4. creates a restricted remembered-device family, refresh generation zero, and access session;
5. retains all pre-existing passkeys, sessions, and remembered-device families;
6. records recovery-started, passkey-added-provisional, and family-created events; and
7. enqueues security notifications.

Retaining existing sessions and passkeys prevents the email claimant from immediately ejecting the
legitimate owner and gives trusted authenticators a chance to cancel recovery. Presentation sets the
new access/refresh cookies and clears account-access/recovery-registration cookies only after commit.

### 5. The five-day restriction is server-authoritative

The restriction is fixed and non-sliding:

```text
restrictionEndsAt = provisionalPasskeyRegisteredAt + 5 days
```

- Use the injected trusted `IClock`; client clocks and countdown state are display-only.
- Refresh, login, status polling, OTP resend, and page reload never alter the timestamp.
- No scheduled mutation automatically trusts the passkey at day five.
- After the timestamp, the passkey becomes eligible for promotion but remains restricted until it
  completes a fresh promotion assertion.
- All families created by authenticating with the provisional credential inherit the same recovery
  ID and restriction; creating a new family cannot wash away provenance.

### 6. Centralize takeover-sensitive authorization

Add one application policy used by every sensitive operation. A request is authorized only when:

1. the access session/family is active;
2. the family has a server-recorded successful passkey assertion inside the existing ten-minute
   recent-authentication window;
3. the assertion was made with a trusted credential; and
4. the family has no active recovery restriction.

At minimum classify these operations as takeover-sensitive:

- adding or removing any passkey;
- changing the recovery email;
- revoking other remembered-device families;
- exporting the complete account data set;
- deleting the account;
- promoting a recovery credential or replacing any trusted credential (replacement of a
  provisional credential remains confined to the recovery lifecycle); and
- any future feature that grants administrative authority, durable access, or bulk disclosure.

Audit current routes during implementation and apply the policy to every operation that already
exists. Future sensitive endpoints must depend on this policy rather than duplicating timestamp or
credential-state checks.

### 7. A trusted passkey can cancel provisional recovery

Before promotion, any successful assertion using a pre-existing trusted passkey atomically:

- cancels the active recovery;
- revokes the provisional passkey;
- revokes every family/session derived from it;
- invalidates recovery challenges/authorizations;
- records cancellation/revocation events; and
- issues the trusted login or recent-auth result normally.

The provisional credential cannot cancel itself. An ordinary session, refresh token, email link,
OTP, account-access cookie, or recovery-registration cookie cannot cancel recovery.

An already authenticated device may start an explicit cancellation assertion. Its options contain
only active trusted credentials. Successful verification cancels recovery and creates/replaces the
current browser's family/session as an unrestricted trusted login. This lets a legitimate owner act
from a notification/banner without treating possession of the existing session as cancellation
proof.

### 8. Promotion requires a fresh assertion after day five

The UI exposes **Finish account recovery** only after server status reports that the restriction has
ended. The promotion options endpoint allows only the provisional credential associated with the
current recovery.

Successful promotion verification atomically:

1. verifies server time is at or after `restrictionEndsAt`;
2. consumes the promotion challenge;
3. marks the recovery promoted and the credential trusted;
4. revokes all existing sessions and remembered-device families, including restricted recovery
   families;
5. creates one new unrestricted family, refresh generation zero, and access session;
6. records recent passkey authentication from the promotion assertion;
7. records recovery-completed, families-revoked, and family-created events; and
8. enqueues completion notification.

Other passkeys remain registered. Because promotion includes a fresh assertion after the full five
days, the new family may satisfy the normal ten-minute recent-authentication requirement. The now-
trusted passkey can subsequently remove older credentials through the normal credential-management
flow. There is no second post-promotion delay.

### 9. Restarting after losing the provisional passkey

Fresh verified email control may explicitly replace an active provisional recovery, but it must not
create multiple provisional credentials:

- status shows that recovery is active and offers **Replace recovery passkey** only after a warning;
- a replacement registration authorization records the active recovery it intends to replace;
- cancellation or browser failure leaves the current provisional credential/session intact;
- only successful replacement registration atomically revokes the prior provisional credential and
  its derived families, creates the replacement, and starts a new five-day restriction;
- it never changes or revokes pre-existing trusted passkeys/families;
- rate limits prevent repeated replacement abuse.

Resetting the five-day clock is acceptable only because the claimant replaced their own provisional
credential; it can never shorten a restriction or age a credential without successful registration.

## Notification reliability

Recovery start/provisional registration, replacement, cancellation, and promotion require security
notifications to the verified recovery email. Notifications contain timestamps and repudiation
guidance but no OTP, cookie, bearer token, credential ID, or secret link.

Because an external email send cannot be atomic with PostgreSQL, add a small database-backed
security-notification outbox:

- enqueue the non-secret notification request in the same transaction as the security state change;
- dispatch only after commit;
- mark delivery success and retry transient failure with bounded backoff;
- use the security event/outbox ID as the provider idempotency/delivery key;
- make permanently failed delivery observable to operations.

The email address used for notification is the same recovery factor and therefore is detection, not
an independent security factor.

## Target browser flow

```text
Existing email OTP verified
  --> 15-minute account-access cookie
  --> /auth/login-recovery
        --> GET account-access status
              |-- Use a passkey
              |     --> account-bound allowCredentials
              |     --> trusted passkey: cancel recovery if active --> unrestricted session --> /
              |     `-- provisional passkey: restricted session --> /
              |
              `-- I can't use a passkey
                    --> explain immediate access + five-day restrictions
                    --> explicit Create a recovery passkey
                    --> 15-minute registration authorization
                    --> navigator.credentials.create()
                    --> verify + persist provisional passkey
                    --> restricted session --> /
                          --> persistent Recovery protection banner
                                |-- before restrictionEndsAt
                                |     --> ordinary access only
                                |     `-- trusted old passkey login --> cancel/revoke recovery
                                `-- at/after restrictionEndsAt
                                      --> Finish account recovery
                                      --> fresh provisional-passkey assertion
                                      --> promote + revoke all families
                                      --> unrestricted replacement session --> /
```

## UI states and content

### `/auth/login-recovery`: choose access method

Load server status from the account-access cookie; router handoff is display metadata only.

Show:

- verified email;
- primary **Use a passkey** when active credentials exist;
- “this device, another device, or a security key” guidance;
- **Keep me signed in on this device**;
- secondary **I can't use a passkey**.

If no active passkeys exist, explain that creating a recovery passkey is required. Do not list
credential IDs, passkey names, transports, backup state, or device history.

### Recovery confirmation

Before starting WebAuthn registration, explain:

- the new passkey grants ordinary account access immediately;
- for five days it cannot add/remove passkeys, change recovery email, revoke other devices, export
  all data, delete the account, or finish takeover-sensitive actions;
- existing passkeys/sessions remain active during protection;
- a login with an existing trusted passkey cancels and revokes the provisional recovery access;
- after five days, a fresh assertion is required to finish recovery and sign out other devices.

Require **Create a recovery passkey** and offer **Back to passkey login**. OTP verification or page
rendering alone must not start recovery.

### Recovery registration

Reuse signup's browser registration/cancellation/error patterns, but use recovery-specific API
endpoints and copy. A retry always requests fresh options. If `excludeCredentials` triggers the
browser's duplicate state after user consent, guide the user back to **Use a passkey**.

### Authenticated provisional state

Extend authenticated session state with:

```ts
interface AuthSecurityState {
  activeRecovery: null | {
    state: "provisional" | "promotion-eligible";
    restrictionEndsAt: string;
  };
  sessionRestriction: null | {
    state: "restricted";
    restrictionEndsAt: string;
  };
}
```

The frontend receives state and timestamps, not internal recovery, credential, or family IDs. The
server retains the internal family-to-recovery binding needed for authorization.

Show a persistent, accessible banner on restricted sessions:

- before day five: “Recovery protection is active until …” and the restricted-operation summary;
- after day five: **Finish account recovery**;
- unavailable status: retain the session, show retry, and do not infer promotion/cancellation.

An unrestricted session that observes `activeRecovery` shows a security alert and **Verify a
passkey to cancel recovery**. That action runs the trusted-only cancellation assertion; it does not
cancel from the session alone. A restricted recovery session shows no self-cancel control.

When a restricted user attempts a sensitive action, the backend returns the stable restriction
error and the UI routes/focuses the banner; client-side disabling is explanatory, not enforcement.

### Terminal and ambiguous states

- Invalid account access or registration authorization: verify email again.
- Trusted-passkey cancellation: clear provisional local auth state and require trusted login.
- Replacement registration cancellation: retain the prior provisional recovery.
- Lost registration verification response: call `GET /auth/session`; if no session, try ordinary
  login with the newly created passkey. Never replay the attestation.
- Lost promotion response: call `GET /auth/session`; never replay the assertion.
- Network/`5xx`: retain cookies/session state and offer explicit retry.

## Public API contracts

All endpoints return `Cache-Control: no-store`. State-changing endpoints require exact allowed
`Origin`, strict input validation, credentialed fetch, and shared abuse limits. Web JSON never
contains account-access, registration, access, or refresh secrets.

### Existing-account OTP continuation

`POST /api/v1/auth/email-verification/verify`

```ts
type ExistingAccountContinuation = {
  next: "login-or-recovery";
  expiresAt: string;
};
```

Presentation sets the account-access cookie and clears stale signup-enrollment and recovery-
registration cookies with their exact attributes.

### Account-access status

`GET /api/v1/auth/account-access`

```ts
interface AccountAccessStatusResponse {
  email: string;
  hasRegisteredPasskeys: boolean;
  activeRecovery:
    | { state: "none" }
    | {
        state: "provisional" | "promotion-eligible";
        restrictionEndsAt: string;
      };
  authorizationExpiresAt: string;
}
```

### Identified passkey login

`POST /api/v1/auth/account-access/passkeys/authentication/options`

- Empty body.
- Returns the existing authentication-options wrapper with required, non-empty
  `options.allowCredentials`.

`POST /api/v1/auth/account-access/passkeys/authentication/verify`

- Reuses the assertion plus `rememberDevice` request.
- Returns the extended `AuthenticatedSessionResponse` and session cookies.
- Trusted credential success consumes account access and cancels active recovery atomically.
- Provisional credential success consumes account access but creates a restricted family.

### Authorize recovery registration or replacement

`POST /api/v1/auth/account-access/recovery`

```ts
interface AuthorizeRecoveryRegistrationRequest {
  mode: "create" | "replace-provisional";
}

interface AuthorizeRecoveryRegistrationResponse {
  next: "recovery-passkey-registration";
  expiresAt: string;
}
```

This consumes account access and sets the 15-minute recovery-registration cookie. `create` conflicts
when an active provisional recovery exists; `replace-provisional` requires one and does not revoke it
until replacement registration commits.

### Recovery passkey registration

`POST /api/v1/auth/recovery/passkeys/registration/options`

- Empty body; requires the recovery-registration cookie.
- Returns `PasskeyRegistrationOptionsResponse` with stable user handle and every active credential
  in `excludeCredentials`.

`POST /api/v1/auth/recovery/passkeys/registration/verify`

- Reuses registration credential plus required `rememberDevice`.
- Returns extended `AuthenticatedSessionResponse`, issues restricted session cookies, and clears the
  limited authorization cookie after commit.

### Recovery status and promotion

`GET /api/v1/auth/recovery/status`

- Requires an authenticated session.
- Returns public `AuthSecurityState` derived from the session family and account recovery.

`POST /api/v1/auth/recovery/promotion/options`

- Requires a restricted authenticated session and server time at/after `restrictionEndsAt`.
- Returns authentication options whose `allowCredentials` contains only the bound provisional
  credential.

`POST /api/v1/auth/recovery/promotion/verify`

- Requires the restricted session and promotion challenge.
- Returns a new unrestricted `AuthenticatedSessionResponse`, replaces cookies, and completes the
  atomic promotion/global family revocation.

### Trusted-passkey cancellation from an authenticated device

`POST /api/v1/auth/recovery/cancellation/options`

- Requires an authenticated session and an active provisional recovery.
- Returns authentication options allowing only active trusted credentials for the account.

`POST /api/v1/auth/recovery/cancellation/verify`

- Reuses the assertion plus `rememberDevice` request.
- Verifies the trusted credential, cancels/revokes provisional recovery state atomically, and
  returns a new unrestricted `AuthenticatedSessionResponse` and cookies.
- A provisional credential is never accepted, even if it is otherwise a valid account credential.

### Stable public errors

| Status | Code | Client behavior |
| --- | --- | --- |
| `401` | `ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED` | Verify email again; do not infer account changes. |
| `401` | `RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED` | Return to verified-email entry. |
| `400` | `IDENTIFIED_PASSKEY_AUTHENTICATION_FAILED` | Request fresh options; keep recovery explicit. |
| `400` | `RECOVERY_PASSKEY_REGISTRATION_FAILED` | Start a fresh registration ceremony. |
| `400` | `RECOVERY_PROMOTION_FAILED` | Request a fresh promotion assertion. |
| `400` | `RECOVERY_CANCELLATION_FAILED` | Request fresh cancellation options; do not change recovery state. |
| `403` | `RECOVERY_SECURITY_RESTRICTION_ACTIVE` | Show `restrictionEndsAt`; do not perform the sensitive operation. |
| `409` | `NO_REGISTERED_PASSKEYS` | Offer recovery; safe only behind account access. |
| `409` | `ACCOUNT_ACCESS_STATE_CONFLICT` | Authorization/challenge changed; never replay. |
| `409` | `RECOVERY_ALREADY_ACTIVE` | Offer provisional login or explicit replacement. |
| `409` | `RECOVERY_PROMOTION_NOT_READY` | Refresh trusted status; server time remains authoritative. |
| `409` | `RECOVERY_STATE_CONFLICT` | Refresh session/status; never replay assertion/attestation. |
| `429` | `ACCOUNT_RECOVERY_RATE_LIMITED` | Honor `Retry-After`; preserve valid state. |
| `503` | `ACCOUNT_RECOVERY_UNAVAILABLE` | Preserve cookies/session and offer explicit retry. |

Unknown, revoked, cross-account, malformed, cryptographic, challenge, counter, and attempt failures
remain grouped into the applicable generic WebAuthn error.

## Persistence and authorization design

### `account_access_authorizations`

Store ID, user ID, source OTP challenge ID, token digest, client binding, creation/fixed expiry, and
consumed/invalidated timestamps. Enforce unique token/source challenge and active user/binding
indexes. One OTP challenge creates at most one account-access authorization.

### `account_recoveries`

Store ID, user ID, provisional credential ID, registered timestamp, fixed restriction-end timestamp,
promoted/cancelled/replaced timestamps, and terminal reason. Enforce at most one active provisional
recovery per user.

### Credential and family provenance

- Add recovery provenance/trust state to passkey credentials without exposing it in public credential
  IDs or WebAuthn options beyond normal descriptors.
- Add recovery ID and fixed restriction timestamp to remembered-device families created from a
  provisional credential.
- Add the credential ID used for recent passkey authentication to the server-side family context so
  the sensitive-operation policy can distinguish trusted from provisional assertions.
- Session refresh preserves family restriction/provenance and cannot extend or erase it.

### WebAuthn challenge binding

Extend `webauthn_challenges` with nullable account-access, recovery-registration, and recovery
foreign keys plus purpose constraints for:

- `identified-passkey-login`;
- `account-recovery-passkey-registration`; and
- `account-recovery-promotion`.

Preserve existing signup-registration and usernameless-login constraints. Challenges remain
five-minute, digest-only, purpose-bound, one-time, and attempt-limited.

### Notification outbox

Add a small `security_notification_outbox` table holding event ID, user/email destination reference,
template/event type, non-secret payload, attempt/next-attempt timestamps, and delivery state. Avoid
duplicating raw credentials or authorization data. Repository transactions enqueue; a bounded
dispatcher sends through `IEmailSender` after commit with provider idempotency.

### Atomic boundaries

Repository-owned transactions cover:

- OTP consumption plus account-access authorization creation;
- account-access consumption plus recovery-registration authorization issuance;
- identified passkey authentication plus either cancellation or restricted/unrestricted session
  creation;
- provisional registration plus optional prior-provisional replacement and restricted family/session
  creation;
- trusted-passkey cancellation plus provisional credential/family/session revocation; and
- promotion plus global family/session revocation and replacement unrestricted family/session.

## Story and branch structure

Create the story integration branch:

```text
codex/immediate-passkey-email-recovery
```

Create one subtask branch per task:

```text
codex/immediate-passkey-email-recovery/contracts
codex/immediate-passkey-email-recovery/persistence
codex/immediate-passkey-email-recovery/account-access
codex/immediate-passkey-email-recovery/identified-login
codex/immediate-passkey-email-recovery/provisional-registration
codex/immediate-passkey-email-recovery/restriction-promotion
codex/immediate-passkey-email-recovery/api-client
codex/immediate-passkey-email-recovery/frontend
codex/immediate-passkey-email-recovery/integration-docs
```

Branch from the story branch or the unmerged dependency, commit and verify each task, and inspect the
diff before switching. Open PRs to the story branch immediately after Task 1 (`api-contracts` gate),
after Tasks 2–6 (backend gate), after Task 8 (frontend gate), and after Task 9 (wiring/documentation
gate).

## Implementation tasks

### Task 1: Define account-access, recovery, and restriction contracts

**Description:** Add strict shared schemas for account-access status, identified login, recovery-
registration authorization, recovery status, promotion, extended session security state, and stable
errors.

**Acceptance criteria:**

- [ ] Identified options require non-empty `allowCredentials`; usernameless options still omit it.
- [ ] Public session security state exposes status/timestamps but no recovery, credential, family, or
  authorization IDs.
- [ ] Every response is strict and contains no token-shaped field.
- [ ] Verification requests reuse existing WebAuthn schemas without weakening validation.

**Test plan:**

- [ ] Accept every exact state and reject mixed states, missing/invalid timestamps, empty
  `allowCredentials`, IDs, tokens, extra fields, and invalid `mode`.
- [ ] Prove existing signup, usernameless login, and ordinary session responses remain compatible.
- [ ] Round-trip every stable error code.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
```

**Dependencies:** Plan 007.

**Files likely touched:** new account-access/recovery contract modules, auth session response schema,
focused tests, and package indexes.

**Estimated scope:** M.

### Task 2: Persist authorization, provenance, and notification state

**Description:** Add migrations, Kysely schemas, repository contracts, integration cleanup, and
constraints for account access, recovery-registration authorization, active recovery, credential/
family provenance, WebAuthn bindings, and the notification outbox.

**Acceptance criteria:**

- [ ] Only digests of raw limited credentials/challenges are stored.
- [ ] One active provisional recovery exists per user; fixed timestamps cannot slide.
- [ ] Every restricted family remains linked to its originating recovery across refresh/login.
- [ ] Existing signup/usernameless challenge constraints still hold.

**Test plan:**

- [ ] Migration tests cover FKs, partial uniqueness, checks, indexes, and down/up behavior.
- [ ] Repository tests prove 15-minute authorization expiry, exact five-day restriction, provenance
  inheritance, single active recovery, and non-secret outbox rows.
- [ ] Concurrency tests prove duplicate active recoveries/credential IDs cannot commit.

**Verification:**

```sh
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 1.

**Files likely touched:** migrations; database-client/Kysely schemas; new application ports; test
fixtures and focused integration tests.

**Estimated scope:** M per migration/schema checkpoint.

### Task 3: Issue and restore post-OTP account access

**Description:** Extend plan 007's existing-account branch to create account access, set its cookie,
and expose status. Keep new-account signup behavior unchanged.

**Acceptance criteria:**

- [ ] Only successful one-time OTP verification creates account access, never a session.
- [ ] Status reports verified email, active-passkey presence, active recovery state, and trusted
  expiries only.
- [ ] Invalid/expired authorization is generic; network/`5xx` preserves cookies.
- [ ] New accounts receive only signup enrollment state.

**Test plan:**

- [ ] Unit/integration tests cover new/existing branches, older authorization invalidation, rollback,
  no/multiple/revoked passkeys, and provisional recovery state.
- [ ] HTTP tests assert exact cookie flags/path, `no-store`, schema, and absence of secrets.
- [ ] Regression tests confirm pre-OTP request/resend remains non-enumerating.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 2.

**Files likely touched:** generalized email-verification service/repository; account-access service and
cookie; controller/routes/container; focused tests.

**Estimated scope:** M.

### Task 4: Implement account-bound login and trusted cancellation

**Description:** Extend WebAuthn authentication options with allowed descriptors and implement
identified login. Make both identified and usernameless authentication aware of credential recovery
trust/provenance.

**Acceptance criteria:**

- [ ] Options contain every and only active credentials owned by the verified account.
- [ ] Verification rejects cross-account/revoked/unknown credentials generically and preserves
  origin/RP/UV/counter/rate-limit policy.
- [ ] Trusted success atomically cancels active recovery and revokes its credential/families.
- [ ] Provisional success creates only a restricted family inheriting the fixed timestamp.

**Test plan:**

- [ ] Adapter tests cover descriptor mapping and unchanged usernameless options.
- [ ] Service tests cover no credentials, ownership, trusted versus provisional selection, counter
  policy, cancellation, conflicts, and unavailable state.
- [ ] Repository tests prove atomic cancellation/session creation and restriction inheritance.
- [ ] HTTP tests cover safe errors, cookies, status metadata, and account-access clearing.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 3.

**Files likely touched:** WebAuthn authentication port/adapter; passkey authentication service/
repository; identified-login service/routes; focused tests.

**Estimated scope:** M per adapter/application/persistence checkpoint.

### Checkpoint: Existing passkey path

- [ ] Verified email can immediately authenticate with a matching account passkey.
- [ ] Browser cancellation leaves recovery explicit and available.
- [ ] Trusted login cancels provisional recovery; provisional login cannot remove its restriction.
- [ ] Usernameless login regression coverage remains green.

### Task 5: Register an immediately usable provisional recovery passkey

**Description:** Implement explicit create/replace authorization and recovery-bound WebAuthn
registration, ending in a restricted authenticated session.

**Acceptance criteria:**

- [ ] Recovery begins only after confirmation and successful server verification of a new passkey.
- [ ] Options require discoverability/UV and exclude all active account credentials.
- [ ] Completion fixes `restrictionEndsAt` at registration time plus five days, retains trusted
  credentials/families/sessions, and issues only a restricted family/session.
- [ ] Replacement revokes only the prior provisional credential and derived families after the new
  credential commits; cancellation leaves them intact.
- [ ] Registration does not establish recent trusted passkey authentication.

**Test plan:**

- [ ] Service/adapter tests cover exact options, duplicate credential, cancellation, fresh retries,
  create/replace conflicts, and browser-created/server-failed ambiguity.
- [ ] Injected-clock/repository tests prove the five-day timestamp starts at committed registration,
  cannot slide, and replacement restarts only after successful replacement.
- [ ] Transaction tests prove retained trusted sessions/passkeys, restricted family/session creation,
  optional prior-provisional revocation, events, outbox, one-time state, and rollback.
- [ ] HTTP tests assert cookie issuance/clearing, `no-store`, session security metadata, and no tokens
  in JSON/logs.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Tasks 2–3.

**Files likely touched:** recovery registration port/service/repository; registration WebAuthn port/
adapter; cookies/controller/routes/container; email/outbox integration; focused tests.

**Estimated scope:** M per authorization/registration/completion checkpoint.

### Task 6: Enforce restrictions and promote after a fresh day-five assertion

**Description:** Centralize sensitive-operation authorization, preserve restriction through session
restoration/refresh, and implement explicit trusted cancellation plus promotion with global family
revocation.

**Acceptance criteria:**

- [ ] Every current sensitive endpoint uses the central policy and returns
  `RECOVERY_SECURITY_RESTRICTION_ACTIVE` for a restricted context.
- [ ] Client time, refresh, new login family, or recent assertion from the provisional credential
  cannot bypass restriction before day five.
- [ ] Promotion options fail before trusted time and allow only the bound provisional credential.
- [ ] Cancellation options allow only trusted credentials and never treat an access session as the
  proof.
- [ ] Successful post-day-five assertion promotes credential, revokes all families/sessions, creates
  one unrestricted replacement family/session, and records recent auth.
- [ ] Existing passkeys remain registered.

**Test plan:**

- [ ] Policy tests cover every sensitive-operation classification with trusted, stale, provisional,
  cancelled, and promotion-eligible contexts.
- [ ] Cancellation tests cover trusted/provisional/cross-account credentials and unrestricted
  replacement-session issuance.
- [ ] Boundary tests run one millisecond before, exactly at, and after `restrictionEndsAt`.
- [ ] Repository tests prove atomic promotion/global revocation, race with trusted cancellation,
  retained passkeys, replacement session, outbox/events, replay rejection, and rollback.
- [ ] Session restoration/refresh tests prove restriction metadata and provenance persist.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Tasks 4–5.

**Files likely touched:** sensitive-operation policy; recovery promotion service/repository; passkey
authentication/session restoration/refresh; controller/routes; focused tests.

**Estimated scope:** M per policy/promotion checkpoint.

### Checkpoint: Backend recovery lifecycle

- [ ] Recovery passkey grants ordinary access immediately but cannot perform any classified sensitive
  operation before promotion.
- [ ] Trusted passkey cancellation and provisional promotion are serialized; exactly one wins.
- [ ] Promotion requires a fresh assertion at/after five full server-timed days.
- [ ] Promotion revokes sessions/families but retains passkeys.

### Task 7: Add typed API-client operations

**Description:** Add schema-validated clients and query/mutation options for account access,
identified login, recovery authorization/registration, status, and promotion.

**Acceptance criteria:**

- [ ] All calls use credentialed fetch and strict schemas.
- [ ] State-changing calls and WebAuthn verification use `retry: false`.
- [ ] Client distinguishes expected restriction/conflict/rate-limit/authorization errors from
  availability failures without reading cookies or untyped internals.

**Test plan:**

- [ ] Assert method/path/body, credentials, parsing, `Retry-After`, and every stable error.
- [ ] Assert no automatic replay of authorization, registration verification, or promotion.
- [ ] Assert bounded idempotent retry classification only for status reads.

**Verification:**

```sh
npx nx run @calibrate/api-client:test
npx nx run @calibrate/api-client:typecheck
```

**Dependencies:** Tasks 1 and 3–6.

**Files likely touched:** new account-access/recovery API-client modules, tests, and exports.

**Estimated scope:** M.

### Task 8: Build login, immediate recovery, restricted-session, and promotion UI

**Description:** Replace the placeholder with the server-driven chooser/registration UI and add the
authenticated recovery-protection banner and promotion ceremony.

**Acceptance criteria:**

- [ ] Reload works from server cookies/session status without trusting router handoff.
- [ ] Identified login, recovery explanation, explicit confirmation, registration, replacement,
  restricted banner, trusted-session cancellation alert, and promotion states show the locked
  copy/actions.
- [ ] Browser cancellation never starts recovery or discards a working provisional credential.
- [ ] Sensitive controls explain restriction but backend enforcement remains authoritative.
- [ ] Login/registration/promotion success caches the returned session and navigates appropriately.

**Test plan:**

- [ ] Component tests cover no/multiple passkeys, chooser, confirmation, registration cancellation,
  replacement warning, pending/eligible banner, unavailable state, trusted cancellation, promotion,
  and ambiguous outcomes.
- [ ] Browser-adapter tests cover account allowlists, exclusion behavior, cancellation, and fresh
  ceremony retries.
- [ ] Routing/session tests cover reload, missing/expired cookies, restricted restoration/refresh,
  and post-promotion navigation.
- [ ] Accessibility checks cover focus, keyboard flow, status announcements, button names, timestamp
  text, and no color-only security state.

**Verification:**

```sh
npx nx run web:test
npx nx run web:test:integration
npx nx run web:typecheck
```

**Dependencies:** Task 7 and backend Tasks 3–6.

**Files likely touched:** `LoginRecoveryPage.tsx` and focused components/tests; auth routes;
account-access/recovery coordinator; browser adapters; session-restoration UI and shared security
banner.

**Estimated scope:** M per chooser/registration/banner checkpoint.

### Task 9: Prove the full flow and record the revised recovery decision

**Description:** Add full HTTP/web integration coverage and create ADR-0003 to supersede
ADR-0002's immediate unrestricted recovery/global-revocation behavior.

**Acceptance criteria:**

- [ ] OTP -> identified trusted passkey -> unrestricted session works.
- [ ] OTP -> recovery registration -> immediate restricted session -> day-five assertion -> promoted
  unrestricted replacement session works.
- [ ] Trusted login during restriction cancels/revokes provisional recovery.
- [ ] Provisional replacement never creates multiple active credentials and cannot shorten the new
  five-day restriction.
- [ ] ADR-0003 records the immediate-access trade-off, restricted operations, server-time policy,
  trusted cancellation, promotion transaction, retained passkeys, session revocation timing, and
  notification outbox.

**Test plan:**

- [ ] Backend HTTP tests use fake email, injected time, and fake WebAuthn for both login and recovery
  paths, including before/at/after day five.
- [ ] Web integration tests cover endpoint order, cookie-driven reload, immediate ordinary access,
  sensitive denial, trusted cancellation, replacement, promotion, and lost-response recovery.
- [ ] Security regression tests cover pre-OTP enumeration resistance, cross-account credentials,
  raw-secret absence, exact origin, replay, rate limits, outbox idempotency, and rollback.
- [ ] Manual two-browser check: browser A registers recovery passkey; browser B signs in with a
  trusted passkey; browser A loses access and cannot promote.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
npx nx run @calibrate/api-client:typecheck
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
npx nx run web:test
npx nx run web:test:integration
npx nx run web:typecheck
npx nx run backend:fmt:check
npx nx run web:fmt:check
```

**Dependencies:** Tasks 1–8.

**Files likely touched:** backend/web auth integration tests;
`apps/backend/docs/adr/0003-provisional-email-recovery-passkeys.md`; a recovery cross-reference in
ADR-0002; implementation task documentation if a locked decision changes.

**Estimated scope:** M.

## Final checkpoint

- [ ] Existing passkey login remains preferred and account-bound after verified email.
- [ ] Recovery registration is explicit and creates one immediately usable provisional passkey.
- [ ] Ordinary access works immediately; every takeover-sensitive operation is denied server-side
  before promotion.
- [ ] Restriction starts at committed registration, lasts five full server-timed days, and never
  slides through login, refresh, polling, resend, or reload.
- [ ] A trusted passkey cancels recovery and revokes provisional credentials/families atomically.
- [ ] Promotion requires a fresh assertion after day five, revokes all sessions/families, creates one
  unrestricted replacement family/session, and retains existing passkeys.
- [ ] Replacement never leaves multiple provisional credentials or destroys the working credential
  before the replacement commits.
- [ ] Security notifications are durably enqueued and contain no bearer secret.
- [ ] Raw credentials/tokens are absent from prohibited persistence, JSON, URLs, browser storage, and
  logs.
- [ ] Contract, client, backend, frontend, integration, typecheck, and formatting checks pass.
- [ ] Diff contains only intended story work and excludes unrelated workspace changes.

## Explicitly deferred

- General passkey naming/listing/removal UI; this slice only enforces the policy it will use.
- Selective device/family management and user-facing security-event history.
- Changing recovery email and adding independent notification addresses.
- Saved recovery codes, second recovery factor, identity proofing, or support escalation.
- Native-client authorization storage and WebAuthn UI.
- Adaptive risk scoring, CAPTCHA choice, geographic/device scoring, or variable restriction periods.
- Restricting ordinary account reads/writes during the five days. If that becomes required, replace
  this model with a pre-access recovery delay or a substantially narrower provisional permission set.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Compromised email gains immediate data access | Critical | Explicitly accept/document for the current threat model; keep bulk export, deletion, and takeover operations restricted; revisit before higher-impact data/features. |
| Provisional session washes away its origin through login/refresh | Critical | Persist recovery provenance on credential and every derived family; central server authorization policy ignores client state. |
| Attacker removes legitimate recovery routes | Critical | Block passkey add/remove, recovery-email change, family revocation, and deletion until promotion; retain trusted passkeys/sessions during restriction. |
| Trusted and provisional assertions race | High | Lock recovery/credential rows; cancellation and promotion are mutually exclusive atomic transitions. |
| Client clock bypasses five days | High | Use trusted injected server clock for options and promotion verification; client timestamp is display-only. |
| Attacker pre-ages recovery without a credential | High | Start restriction only when registration verifies and commits. |
| Lost provisional passkey causes lockout | Medium | Fresh verified email may atomically replace only the provisional credential, starting a new five-day period after replacement commit. |
| Notification send is lost after commit | High | Transactional DB outbox with idempotent post-commit delivery and observable retry state. |
| Sensitive endpoint is added without the restriction check | High | Central policy dependency, route inventory, ADR rule, and tests that enumerate every classified operation. |
| Lost WebAuthn response causes replay | High | Never replay assertion/attestation; inspect session/status and start a fresh ceremony. |

## References

- [NIST SP 800-63B: Account Recovery](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery)
- [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

## Open questions

None for this slice. Immediate ordinary access, a fixed five-day provisional restriction, promotion
by fresh assertion, trusted-passkey cancellation, retained passkeys/sessions until promotion, global
family revocation at promotion, and no second delay are treated as locked decisions for review.
