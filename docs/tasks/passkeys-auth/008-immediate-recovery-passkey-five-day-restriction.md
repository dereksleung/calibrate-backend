# Implementation Plan: Immediate Recovery Passkey with a Five-Day Security Restriction

## Outcome and scope

Implement the existing-account continuation from
[007-unified-email-entry-and-post-otp-routing.md](./007-unified-email-entry-and-post-otp-routing.md)
as an immediate web login and recovery slice:

1. Verified email control issues a short-lived account-access authorization, not a session.
2. The user can immediately attempt identifier-first login with one of the account's existing
   passkeys.
3. If no existing passkey is usable, the user can explicitly start recovery and register a new
   passkey immediately.
4. That recovery-created passkey can authenticate and use ordinary account features immediately,
   but remains provisional for five server-timed days.
5. During those five days, the provisional passkey and every session derived from it have
   server-recorded restricted access.

For now, item 5 creates the persistence and session-state boundary only. Many takeover-sensitive
operations have not been implemented, so this plan does not attempt their broad authorization
inventory or enforcement. Every current or future sensitive route must consume this lineage before
the operation is exposed.

Trusted-passkey cancellation and fresh-assertion promotion after the five-day period are in
[009-recovery-cancellation-and-provisional-passkey-promotion.md](./009-recovery-cancellation-and-provisional-passkey-promotion.md).

This slice excludes general credential management, selective device management, recovery-email
changes, additional recovery factors, native transport, support recovery, cancellation, promotion,
global revocation, and a central sensitive-operation policy.

## Prerequisites

- Complete plan 007 through the login-or-recovery branch and placeholder route.
- Preserve usernameless passkey login from plan 004 and session creation/restoration from plan 005.
- Reuse the existing WebAuthn adapters, opaque token service, session lifetime calculator, cookie
  helpers, PostgreSQL transaction conventions, and injected trusted clock. Add no dependency.

## Explicit security trade-off

This design protects against immediate persistent account takeover, not immediate account access. An
attacker who controls the recovery inbox can register a provisional passkey and immediately use
ordinary authenticated features. The fixed five-day restriction creates detection and intervention
time before recovery can become durable trusted authority.

For the current consumer-wellness threat model, accepting immediate ordinary access is a material
reduction from a five-day pre-access delay. Revisit this trade-off before adding financial,
clinician, regulated, administrative, or bulk-export features. Email remains the recovery assurance
floor; the restriction period does not make compromised email phishing-resistant proof.

## Locked restriction-tracking design

The database records provenance at the credential and remembered-device-family boundaries:

- account_recoveries stores the user, provisional credential, registration time, fixed
  restrictionEndsAt, and enough replacement/terminal state to enforce at most one active recovery.
- passkey_credentials receives nullable recovery_id. A non-null value marks the recovery-created
  provisional credential without changing its public WebAuthn identifier.
- remembered_device_families receives nullable recovery_id. Every family created by a provisional
  credential records the same recovery ID.
- sessions already reference a remembered-device family, and refresh_token_generations already
  reference one. Session validation and refresh load the family recovery ID; they do not add a
  duplicated mutable restricted flag to individual access-session or refresh-token rows.

The recovery record owns restrictionEndsAt. A family with recovery_id is restricted while its
recovery is active, regardless of how many access sessions or refresh generations it creates.
Refresh and restoration preserve that ID. Presentation receives only restricted state and the
timestamp, never recovery, credential, family, session, or token IDs.

## Locked authority model

| Authority/state | Lifetime | May do | Must not do |
| --- | --- | --- | --- |
| Account-access authorization | 15 minutes, fixed | Read post-OTP status, do account-bound passkey login, or authorize one recovery registration | Call ordinary APIs, create a session without WebAuthn, register multiple passkeys, or change account data |
| Recovery-registration authorization | 15 minutes, fixed and single-purpose | Request and verify one new passkey for the bound account | Authenticate, call ordinary APIs, remove credentials, or survive successful registration |
| Provisional recovery passkey | Until replaced, cancelled, or promoted | Authenticate and create recovery-derived restricted sessions | Claim trusted status or erase its provenance |
| Recovery-derived family/session | Normal family/session lifetime caps | Call ordinary authenticated APIs and expose restriction state | Lose provenance through refresh, restoration, or access-session replacement |
| Existing trusted passkey | Normal credential lifecycle | Authenticate and create an unrestricted family/session | Implicitly cancel recovery in this slice |

All account-access and recovery-registration authorities are opaque secrets of at least 256 bits.
Persist only SHA-256 digests. Web delivery uses HttpOnly, Secure, SameSite=Strict, host-only,
path-scoped cookies. JavaScript, URLs, router state, analytics, logs, traces, and response JSON
never receive the secrets.

## Locked recovery lifecycle

### 1. OTP verification issues account access

Extend plan 007's existing-account transaction to create a 15-minute account-access authorization
bound to the user, OTP challenge, and client transport; invalidate older unconsumed authorizations
for that binding; set a path-scoped account-access cookie; return login-or-recovery and its expiry;
and create no session or recovery credential.

Successful account-bound login or recovery start consumes this authorization atomically.

### 2. Identifier-first passkey login remains preferred

Account-access status may reveal whether the verified account has active passkeys. Identified
options return all and only the account's active credential IDs and transports in a required,
non-empty allowCredentials list.

- Never omit allowCredentials from the identified endpoint; omission becomes usernameless discovery.
- Bind the challenge to account access, user, purpose, and expiry.
- Accept only an active credential owned by that user.
- Preserve exact origin, RP ID, challenge, signature, user-presence, user-verification, one-time
  use, counter, attempt-limit, and shared-rate-limit policy.
- Browser cancellation or no local match leaves recovery explicit; it never starts automatically.

A trusted credential creates an ordinary unrestricted family/session. A provisional credential
creates only a family/session with its recovery_id. Plan 009 later adds trusted cancellation of an
active recovery.

### 3. Recovery registration is explicit and immediate

I can't use a passkey opens a confirmation screen. Only Create a recovery passkey consumes account
access and issues a 15-minute recovery-registration authorization.

The ceremony uses the stable opaque WebAuthn user handle; requires discoverable credentials and user
verification; uses attestation none; excludes every active credential; caps option requests and
verification attempts; rejects globally duplicate credential IDs; and requests a fresh challenge for
each retry.

The five-day clock starts only after server verification and persistence succeeds. Email
verification, page display, options requests, or a browser credential whose verification fails do
not age the restriction.

### 4. Provisional registration creates restricted access without displacing the owner

One successful registration transaction:

1. consumes the challenge and recovery-registration authorization;
2. creates account recovery with restrictionEndsAt equal to registeredAt plus five days;
3. inserts the passkey bound to that recovery as provisional;
4. creates a recovery-derived remembered-device family, refresh generation zero, and access session;
5. retains pre-existing passkeys, sessions, and remembered-device families;
6. records recovery-started, passkey-added-provisional, and family-created events; and
7. enqueues a security notification.

Set the new access/refresh cookies and clear limited authorization cookies only after commit.

### 5. The restriction is server-authoritative

The fixed, non-sliding value is:

    restrictionEndsAt = provisionalPasskeyRegisteredAt + 5 days

- Use the injected trusted clock; client clocks and countdowns are display-only.
- Refresh, login, status polling, OTP resend, and reload never alter the timestamp.
- No scheduled mutation changes credential trust at day five.
- The family recovery ID survives refresh and access-session replacement.
- Session restoration returns the same public restricted state by loading family provenance.

Plan 009 later makes the credential promotion-eligible after this timestamp and requires a fresh
assertion to make it trusted.

### 6. Restart after losing the provisional passkey

Fresh verified email may explicitly replace an active provisional recovery, but cannot create
multiple provisional credentials:

- status offers Replace recovery passkey only after a warning;
- a replacement authorization records the active recovery it intends to replace;
- cancellation or browser failure retains the current provisional credential/session;
- only successful replacement atomically revokes the prior provisional credential and its derived
  families, creates the replacement, and starts a new five-day restriction; and
- it never changes or revokes existing trusted passkeys/families.

## Notification reliability

Recovery start, provisional registration, and replacement notify the verified recovery email without
OTP, cookie, bearer token, credential ID, or secret link.

Add a small database-backed security-notification outbox:

- enqueue a non-secret request in the recovery transaction;
- dispatch only after commit;
- retry transient failure with bounded backoff;
- use the event/outbox ID as the provider idempotency key; and
- make permanent delivery failure observable.

The recovery email is detection, not an independent security factor.

## Target browser flow

    Existing email OTP verified
      --> 15-minute account-access cookie
      --> /auth/login-recovery
            --> account-access status
                  |-- Use a passkey
                  |     |-- trusted passkey --> unrestricted session
                  |     +-- provisional passkey --> recovery-derived restricted session
                  |
                  +-- I can't use a passkey
                        --> explicit Create a recovery passkey
                        --> 15-minute registration authorization
                        --> browser registration
                        --> persist provisional passkey
                        --> recovery-derived restricted session
                        --> Recovery protection banner

Cancellation and Finish account recovery are plan 009 controls.

## UI states and content

### Login/recovery chooser

Load server status from the account-access cookie; router handoff is display metadata only. Show the
verified email, primary Use a passkey when credentials exist, device/security-key guidance, Keep me
signed in on this device, and secondary I can't use a passkey. Do not reveal credential IDs,
passkey names, transports, backup state, or device history.

### Recovery confirmation and registration

Explain that the new passkey grants ordinary account access immediately, shows restricted recovery
state for five days, and leaves existing passkeys/sessions active. Require explicit Create a recovery
passkey and offer Back to passkey login. Registration retries always request fresh options.

### Authenticated provisional state

Extend session state:

    interface AuthSecurityState {
      activeRecovery: null | {
        state: "provisional";
        restrictionEndsAt: string;
      };
      sessionRestriction: null | {
        state: "restricted";
        restrictionEndsAt: string;
      };
    }

Show a persistent accessible banner for a restricted session: Recovery protection is active until
the displayed server timestamp. The banner accurately explains server-recorded restriction state;
it does not claim to enforce operations that have not been implemented. Unavailable status retains
the session and offers retry.

## Public API contracts

Every endpoint returns Cache-Control: no-store. State-changing endpoints require exact allowed
Origin, strict validation, credentialed fetch, and shared abuse limits. Web JSON never contains
account-access, registration, access, or refresh secrets.

### Existing-account OTP continuation

POST /api/v1/auth/email-verification/verify returns:

    type ExistingAccountContinuation = {
      next: "login-or-recovery";
      expiresAt: string;
    };

Set the account-access cookie and clear stale signup-enrollment/recovery-registration cookies with
their exact attributes.

### Account-access status

GET /api/v1/auth/account-access returns:

    interface AccountAccessStatusResponse {
      email: string;
      hasRegisteredPasskeys: boolean;
      activeRecovery:
        | { state: "none" }
        | { state: "provisional"; restrictionEndsAt: string };
      authorizationExpiresAt: string;
    }

### Identified login

POST /api/v1/auth/account-access/passkeys/authentication/options returns the existing options
wrapper with required, non-empty allowCredentials.

POST /api/v1/auth/account-access/passkeys/authentication/verify reuses the assertion and
rememberDevice request, returns extended session state/cookies, and creates a recovery-derived
family only when the asserting credential has recovery_id.

### Recovery authorization and registration

POST /api/v1/auth/account-access/recovery accepts:

    interface AuthorizeRecoveryRegistrationRequest {
      mode: "create" | "replace-provisional";
    }

It consumes account access, sets the 15-minute recovery-registration cookie, and returns its expiry.
Create conflicts with an active recovery; replace-provisional retains the current one until the
replacement commits.

POST /api/v1/auth/recovery/passkeys/registration/options requires that cookie and returns
registration options using the stable user handle and all active credentials in excludeCredentials.

POST /api/v1/auth/recovery/passkeys/registration/verify reuses the registration credential plus
rememberDevice, returns extended session state, issues recovery-derived cookies, and clears the
limited authorization cookie after commit.

### Recovery status and stable errors

GET /api/v1/auth/recovery/status requires an authenticated session and returns AuthSecurityState
derived from family and recovery provenance.

| Status | Code | Client behavior |
| --- | --- | --- |
| 401 | ACCOUNT_ACCESS_AUTHORIZATION_REQUIRED | Verify email again; do not infer account changes. |
| 401 | RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED | Return to verified-email entry. |
| 400 | IDENTIFIED_PASSKEY_AUTHENTICATION_FAILED | Request fresh options; keep recovery explicit. |
| 400 | RECOVERY_PASSKEY_REGISTRATION_FAILED | Start a fresh registration ceremony. |
| 403 | RECOVERY_SECURITY_RESTRICTION_ACTIVE | Preserve known restriction state; do not perform a route once it adopts the policy. |
| 409 | NO_REGISTERED_PASSKEYS | Offer recovery only behind account access. |
| 409 | ACCOUNT_ACCESS_STATE_CONFLICT | Authorization/challenge changed; never replay. |
| 409 | RECOVERY_ALREADY_ACTIVE | Offer provisional login or explicit replacement. |
| 409 | RECOVERY_STATE_CONFLICT | Refresh session/status; never replay assertion or attestation. |
| 429 | ACCOUNT_RECOVERY_RATE_LIMITED | Honor Retry-After and preserve valid state. |
| 503 | ACCOUNT_RECOVERY_UNAVAILABLE | Preserve cookies/session and offer explicit retry. |

## Persistence and transaction design

### Tables

- account_access_authorizations: ID, user ID, source OTP challenge ID, token digest, client binding,
  creation/fixed expiry, consumed/invalidated timestamps, and active-binding indexes.
- account_recoveries: ID, user ID, provisional credential ID, registration timestamp, fixed
  restriction-end timestamp, replacement/terminal timestamps, terminal reason, and partial
  uniqueness for one active recovery per user.
- passkey_credentials: nullable recovery_id for the provisional credential.
- remembered_device_families: nullable recovery_id for every recovery-derived family.
- webauthn_challenges: nullable account-access and recovery-registration foreign keys and constrained
  identified-login/recovery-registration purposes.
- security_notification_outbox: event ID, recipient reference, template/event type, non-secret
  payload, attempt/next-attempt timestamps, and delivery state.

Do not add restriction columns to sessions or refresh_token_generations. They derive restriction
through their family relation.

### Atomic boundaries

Repository-owned transactions cover:

- OTP consumption plus account-access creation;
- account-access consumption plus recovery-registration authorization issuance;
- identified authentication plus restricted or unrestricted family/session creation;
- provisional registration plus optional prior-provisional replacement and restricted family/session
  creation; and
- refresh/restoration while preserving family recovery provenance.

## Story and branch structure

Create the story integration branch:

    codex/immediate-passkey-email-recovery

Create subtask branches:

    codex/immediate-passkey-email-recovery/contracts
    codex/immediate-passkey-email-recovery/persistence
    codex/immediate-passkey-email-recovery/account-access
    codex/immediate-passkey-email-recovery/identified-login
    codex/immediate-passkey-email-recovery/provisional-registration
    codex/immediate-passkey-email-recovery/api-client
    codex/immediate-passkey-email-recovery/frontend
    codex/immediate-passkey-email-recovery/integration-docs

Commit and verify each task. Open PRs to the story branch after Task 1, after Tasks 2–5, after
Task 7, and after Task 8.

## Implementation tasks

### Task 1: Define account-access, recovery, and restriction contracts

**Acceptance criteria:**

- [ ] Identified options require non-empty allowCredentials; usernameless options still omit it.
- [ ] Public session state exposes restriction state/timestamps but no internal IDs or secrets.
- [ ] Every response is strict and verification requests reuse existing WebAuthn schemas.

**Test plan:**

- [ ] Contract tests accept exact states and reject mixed states, invalid timestamps, empty
  allowCredentials, IDs, tokens, and extra fields.
- [ ] Compatibility tests preserve signup, usernameless login, and ordinary-session contracts.

**Verification:**

    npx nx run @calibrate/api-contracts:test

**Dependencies:** Plan 007.

### Task 2: Persist authorization and restriction provenance

**Acceptance criteria:**

- [ ] Only digests of limited credentials/challenges are stored.
- [ ] One active provisional recovery exists per user and the fixed timestamp cannot slide.
- [ ] Every family/session/refresh generation from a provisional credential retains family-derived
  recovery provenance.
- [ ] Existing signup and usernameless challenge constraints continue to hold.

**Test plan:**

- [ ] Migration tests cover foreign keys, partial uniqueness, checks, indexes, and up/down behavior.
- [ ] Repository tests prove authorization expiry, exact restriction timing, provenance inheritance,
  concurrency safety, and non-secret outbox rows.

**Verification:**

    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Task 1.

### Task 3: Issue and restore post-OTP account access

**Acceptance criteria:**

- [ ] Only one-time OTP verification creates account access, never a session.
- [ ] Status reports verified email, passkey presence, active recovery state, and trusted expiries.
- [ ] New accounts receive only signup enrollment state.

**Test plan:**

- [ ] Unit/integration tests cover existing/new branches, invalidation, rollback, and provisional
  recovery status.
- [ ] HTTP tests assert exact cookies, no-store, schema, secret absence, and non-enumeration.

**Verification:**

    npx nx run backend:test
    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Task 2.

### Task 4: Implement account-bound login with provenance-aware sessions

**Acceptance criteria:**

- [ ] Options contain every and only active credentials owned by the verified account.
- [ ] Verification preserves existing origin/RP/UV/counter/rate-limit protections.
- [ ] Trusted credentials create unrestricted families; provisional credentials create only
  recovery-derived families.

**Test plan:**

- [ ] Adapter/service tests cover descriptors, ownership, no credentials, trusted/provisional
  selection, counter policy, conflicts, and unchanged usernameless options.
- [ ] Repository/HTTP tests prove atomic session creation, provenance inheritance, safe errors,
  cookies, and account-access clearing.

**Verification:**

    npx nx run backend:test
    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Task 3.

### Task 5: Register an immediately usable provisional recovery passkey

**Acceptance criteria:**

- [ ] Recovery starts only after confirmation and verified registration.
- [ ] Options require discoverability/UV and exclude every active credential.
- [ ] Registration fixes restrictionEndsAt, retains existing passkeys/families/sessions, and creates
  only a recovery-derived family/session.
- [ ] Replacement revokes the prior provisional lineage only after the replacement commits.

**Test plan:**

- [ ] Service/adapter tests cover options, duplicate credentials, browser cancellation, fresh
  retries, create/replace conflicts, and ambiguous registration outcomes.
- [ ] Clock/repository/transaction tests prove timing, provenance, replacement safety, events,
  outbox, one-time state, and rollback.
- [ ] HTTP tests assert cookies, no-store, security metadata, and no secrets in JSON/logs.

**Verification:**

    npx nx run backend:test
    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Tasks 2–3.

### Task 6: Add typed API-client operations

**Acceptance criteria:**

- [ ] Clients for account access, identified login, registration, and status use credentialed fetch
  and strict schemas.
- [ ] State-changing calls and WebAuthn verification use retry: false.

**Test plan:**

- [ ] Client tests assert method/path/body, credentials, parsing, Retry-After, stable errors, and
  no automatic replay.

**Verification:**

    npx nx run @calibrate/api-client:test
    npx nx run @calibrate/api-client:typecheck

**Dependencies:** Tasks 1 and 3–5.

### Task 7: Build login, immediate recovery, and restricted-session UI

**Acceptance criteria:**

- [ ] Reload uses server cookies/session status rather than router handoff.
- [ ] The chooser, confirmation, registration, replacement, and restricted banner show locked
  copy/actions.
- [ ] Browser cancellation never starts recovery or discards a working provisional credential.
- [ ] The UI reports restriction state without claiming to enforce unimplemented operations.

**Test plan:**

- [ ] Component/browser-adapter tests cover chooser, confirmation, cancellation, replacement,
  restricted state, retries, allowlists, exclusion, and fresh ceremonies.
- [ ] Routing/session/accessibility tests cover reload, expired cookies, restricted restoration,
  keyboard flow, focus, announcements, timestamp text, and no color-only state.

**Verification:**

    npx nx run web:test
    npx nx run web:test:integration
    npx nx run web:typecheck

**Dependencies:** Task 6 and backend Tasks 3–5.

### Task 8: Prove the immediate recovery slice and document the handoff

**Acceptance criteria:**

- [ ] OTP to trusted identified passkey creates an unrestricted session.
- [ ] OTP to recovery registration creates an immediate recovery-derived restricted session.
- [ ] Replacement never creates multiple provisional credentials or shortens the new five-day period.
- [ ] Documentation clearly defers cancellation, promotion, global revocation, and broad
  sensitive-operation enforcement to plan 009 or later work.

**Test plan:**

- [ ] Backend/web integration tests use fake email, injected time, and fake WebAuthn for login,
  registration, reload, restriction state, replacement, and lost responses.
- [ ] Security regression tests cover enumeration resistance, cross-account credentials, raw-secret
  absence, exact origin, replay, rate limits, outbox idempotency, and rollback.
- [ ] Manual two-browser check verifies a recovery-derived session and an existing trusted session
  coexist without revocation.

**Verification:**

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

**Dependencies:** Tasks 1–7.

## Final checkpoint

- [ ] Existing passkey login remains preferred and account-bound after verified email.
- [ ] Recovery registration is explicit and creates one immediately usable provisional passkey.
- [ ] Ordinary access works immediately and its recovery-derived lineage is recorded server-side.
- [ ] The fixed five-day timestamp never slides through login, refresh, polling, resend, or reload.
- [ ] Every recovery-derived access session and refresh token remains connected through its
  remembered-device family.
- [ ] Replacement is atomic and preserves the working credential until the replacement commits.
- [ ] Security notifications use a durable outbox and contain no bearer secret.
- [ ] Contract, client, backend, frontend, integration, typecheck, and formatting checks pass.

## Explicitly deferred

- Trusted-passkey cancellation and fresh-assertion promotion with global family/session revocation:
  plan 009.
- A shared policy and route inventory for takeover-sensitive authorization.
- General passkey/device management, recovery-email changes, independent notification addresses,
  recovery codes, second factors, identity proofing, support recovery, native storage, and risk
  scoring.
- Restricting ordinary account reads/writes during the five days.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Compromised email gains immediate data access | Critical | Explicitly accept for the current threat model and revisit before higher-impact features. |
| Provisional session loses provenance through login/refresh | Critical | Recovery ID on credential and every derived family; sessions/tokens derive through that family. |
| Attacker pre-ages recovery without a credential | High | Start the period only when registration verifies and commits. |
| Lost provisional passkey causes lockout | Medium | Verified email may atomically replace only the provisional credential after successful registration. |
| Notification send is lost after commit | High | Transactional outbox with idempotent post-commit delivery and observable retry state. |
| A future sensitive endpoint omits enforcement | High | Persist authoritative provenance now; require a later shared policy before exposing it. |

## References

- [NIST SP 800-63B: Account Recovery](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery)
- [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

## Open questions

None. Immediate ordinary access, fixed five-day recovery provenance, and replacement only after
successful registration are locked. Cancellation and promotion are specified by plan 009.
