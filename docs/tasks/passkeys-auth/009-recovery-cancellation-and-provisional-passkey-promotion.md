# Implementation Plan: Trusted Recovery Cancellation and Provisional-Passkey Promotion

## Outcome and scope

Build on the immediate recovery slice in
[008-immediate-recovery-passkey-five-day-restriction.md](./008-immediate-recovery-passkey-five-day-restriction.md):

1. A pre-existing trusted passkey can cancel an active recovery during its restriction period.
2. After five server-timed days, a fresh assertion from the provisional passkey promotes it to
   trusted, revokes all prior sessions and remembered-device families, and creates a replacement
   unrestricted family/session.

This plan consumes the recovery provenance and restriction fields established by plan 008. It adds
the lifecycle transitions that act on them; it does not reimplement verified-email account access,
identified login, or provisional registration.

The plan also does not inventory and centralize every takeover-sensitive operation. Most of those
operations do not exist yet. Future sensitive routes must use the restriction provenance introduced
by plan 008 and a shared authorization policy, but that broader enforcement work is deliberately
separate from this recovery-lifecycle slice.

## Prerequisites

- Complete plan 008, including account recoveries, provisional credential provenance, and
  family-level recovery provenance.
- Preserve the usernameless login, session restoration, refresh rotation, and recent-passkey
  authentication behavior from plans 004 and 005.
- Reuse the existing WebAuthn adapters, opaque token service, session lifetime calculator, cookie
  helpers, PostgreSQL transaction conventions, and injected trusted clock. Add no dependency.

## Locked authority model

| Authority/state | May do | Must not do |
| --- | --- | --- |
| Trusted passkey | Authenticate normally; cancel an active provisional recovery with a fresh assertion | Treat an ordinary session, email, or OTP as cancellation proof |
| Provisional recovery passkey before the fixed end | Authenticate only into the restricted lineage created by plan 008 | Cancel itself or promote before trusted server time |
| Provisional recovery passkey at or after the fixed end | Start the explicit promotion assertion | Become trusted without that fresh assertion |
| Recovery-derived family/session | Carry the recovery restriction through refresh and session restoration | Lose the restriction through a new access session or refresh generation |
| Promoted passkey and replacement family/session | Use the ordinary credential/session lifecycle | Preserve any pre-promotion family or session |

All challenge and authorization secrets remain opaque, at least 256-bit values. Persist only their
SHA-256 digests. Web delivery remains HttpOnly, Secure, SameSite=Strict, host-only, and path-scoped;
the browser never receives those secrets in JSON, URLs, router state, analytics, logs, or traces.

## Locked recovery lifecycle

### 1. A trusted passkey can cancel recovery during the restriction period

Before restrictionEndsAt, a successful assertion using any active credential that predates the active
recovery and is not marked provisional atomically:

1. marks the recovery cancelled;
2. revokes its provisional credential;
3. revokes every remembered-device family and access session carrying that recovery ID;
4. invalidates outstanding recovery challenges and recovery-registration authorizations;
5. records cancellation and revocation events and enqueues a security notification; and
6. issues the trusted login or recent-authentication result normally.

The provisional credential itself is never eligible. Neither an ordinary access session, refresh
token, email link, OTP, account-access authorization, nor recovery-registration authorization can
cancel recovery.

The same transition runs before issuing a normal session for a trusted assertion through
account-bound or usernameless login. It is not a separate client action in those paths; the fresh
trusted assertion is the cancellation proof.

An authenticated owner may explicitly start a cancellation assertion from the recovery alert. Its
options contain only active trusted credentials. Successful verification cancels recovery and
creates or replaces the current browser family/session as an unrestricted trusted login. Possession
of the existing session is not cancellation proof.

### 2. Promotion requires a fresh assertion after five days

The client exposes Finish account recovery only when recovery status, calculated by the server,
reports that the fixed restriction end has passed. Promotion options allow only the provisional
credential bound to the current active recovery.

Successful promotion verification atomically:

1. verifies trusted server time is at or after restrictionEndsAt;
2. consumes the promotion challenge;
3. marks the recovery promoted and its credential trusted;
4. revokes every existing remembered-device family, refresh generation, and access session,
   including recovery-derived ones;
5. creates one new unrestricted family at refresh generation zero and one access session;
6. records recent passkey authentication from the promotion assertion;
7. records recovery-completed, families-revoked, and family-created events; and
8. enqueues a completion notification.

Other trusted passkeys remain registered. The fresh successful assertion after the full five days
may satisfy the ordinary ten-minute recent-authentication requirement. There is no second
post-promotion delay.

### 3. Races and ambiguous outcomes

Cancellation and promotion serialize on the active recovery and provisional credential rows. Exactly
one terminal transition can commit. The losing request receives a stable conflict and must inspect
session/recovery status; it must never replay an assertion.

If a cancellation or promotion verification response is lost, the client calls GET /auth/session.
It never replays the assertion. Network and 5xx outcomes retain existing cookies and session state
and offer explicit retry.

## UI states and content

Extend the plan 008 recovery-protection presentation:

- An unrestricted session that observes an active recovery shows a security alert with Verify a
  passkey to cancel recovery. It starts the trusted-only cancellation ceremony; the session itself
  does not cancel recovery.
- A restricted recovery session shows no self-cancel control.
- After restrictionEndsAt, a restricted recovery session shows Finish account recovery and starts
  a fresh provisional-passkey assertion.
- Before the fixed end, promotion controls are absent. Client time is display-only.
- When an operation ends in cancellation or promotion, replace local session state only from the
  committed response or a subsequent session-status read.

## Public API contracts

All endpoints return Cache-Control: no-store. State-changing endpoints require the exact allowed
Origin, strict input validation, credentialed fetch, and shared abuse limits. Web JSON contains no
account-access, registration, access, refresh, or challenge secret.

### Recovery status

GET /api/v1/auth/recovery/status continues to require an authenticated session. Extend plan 008's
status shape only with the public state needed to show cancellation and promotion:

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

The response contains no recovery, credential, family, or token identifier.

### Trusted-passkey cancellation

POST /api/v1/auth/recovery/cancellation/options:

- requires an authenticated session and an active provisional recovery;
- requires trusted server time before restrictionEndsAt;
- returns authentication options allowing only active trusted credentials for that account; and
- records a cancellation-specific, five-minute, one-time WebAuthn challenge.

POST /api/v1/auth/recovery/cancellation/verify:

- verifies the assertion and rejects provisional, cross-account, revoked, or unknown credentials
  generically;
- completes the atomic cancellation transition; and
- returns the unrestricted authenticated-session response and replacement cookies.

The existing account-bound and usernameless authentication verification endpoints also invoke this
same transition before issuing a trusted normal session when the asserting credential predates an
active recovery.

### Promotion

POST /api/v1/auth/recovery/promotion/options:

- requires a restricted authenticated session and trusted server time at or after restrictionEndsAt;
- returns authentication options with allowCredentials containing only the bound provisional
  credential; and
- records a promotion-specific, five-minute, one-time WebAuthn challenge.

POST /api/v1/auth/recovery/promotion/verify:

- requires the restricted session and promotion challenge;
- completes the atomic promotion/global-revocation transition; and
- returns the new unrestricted authenticated-session response and replacement cookies.

### Stable public errors

| Status | Code | Client behavior |
| --- | --- | --- |
| 400 | RECOVERY_PROMOTION_FAILED | Request fresh promotion options; do not replay the assertion. |
| 400 | RECOVERY_CANCELLATION_FAILED | Request fresh cancellation options; do not change local recovery state. |
| 409 | RECOVERY_PROMOTION_NOT_READY | Refresh status; server time remains authoritative. |
| 409 | RECOVERY_STATE_CONFLICT | Refresh session/status; never replay assertion or attestation. |
| 429 | ACCOUNT_RECOVERY_RATE_LIMITED | Honor Retry-After and preserve valid state. |
| 503 | ACCOUNT_RECOVERY_UNAVAILABLE | Preserve cookies/session and offer explicit retry. |

Unknown, revoked, malformed, cryptographic, challenge, counter, and attempt failures remain grouped
into the applicable generic WebAuthn error.

## Persistence and transaction design

Plan 008 owns the recovery ID on the provisional credential and every recovery-derived
remembered-device family. A family remains the source of truth for its access sessions and refresh
generations, so this plan must not add duplicated restriction columns to session or token rows.

Extend account_recoveries with terminal-state data, for example terminal_at and terminal_reason
with constrained cancelled, promoted, or replaced values. Keep the existing partial uniqueness for
one active recovery per user. A migration must make terminal transitions irreversible.

Extend webauthn_challenges with a nullable recovery foreign key and constrained purposes:

- account-recovery-cancellation; and
- account-recovery-promotion.

Repository-owned transactions cover:

- trusted-passkey cancellation plus provisional credential, recovery-derived family, refresh, and
  access-session revocation; and
- promotion plus all-family/session revocation and replacement unrestricted family/session creation.

The notification outbox created by plan 008 receives cancellation and promotion messages in those
same transactions. Its dispatcher remains post-commit and idempotent.

## Story and branch structure

Create the story integration branch:

    codex/recovery-cancellation-and-promotion

Create one subtask branch per task:

    codex/recovery-cancellation-and-promotion/contracts
    codex/recovery-cancellation-and-promotion/persistence
    codex/recovery-cancellation-and-promotion/cancellation
    codex/recovery-cancellation-and-promotion/promotion
    codex/recovery-cancellation-and-promotion/api-client
    codex/recovery-cancellation-and-promotion/frontend-docs

Branch from the story branch or an unmerged dependency, commit and verify each task, and inspect the
diff before switching. Open PRs to the story branch after Task 1, after Tasks 2–4, and after Task 6.

## Implementation tasks

### Task 1: Extend recovery lifecycle contracts

**Description:** Add strict shared schemas for promotion eligibility, trusted cancellation, promotion,
extended authenticated security state, and stable recovery lifecycle errors.

**Acceptance criteria:**

- [ ] Public status exposes only state and restriction-end timestamp, never internal IDs or secrets.
- [ ] Cancellation and promotion verification reuse existing strict WebAuthn schemas.
- [ ] Promotion options cannot be requested before server time reaches the fixed end.

**Test plan:**

- [ ] Contract unit tests accept exact states and reject extra fields, IDs, tokens, invalid
  timestamps, and invalid error codes.
- [ ] Compatibility tests retain plan 008 account-access and authenticated-session contracts.

**Verification:**

    npx nx run @calibrate/api-contracts:test

**Dependencies:** Plan 008.

### Task 2: Persist terminal transitions and recovery-bound challenges

**Description:** Add migrations, Kysely schemas, repository contracts, and integration cleanup for
recovery terminal state and cancellation/promotion challenge binding.

**Acceptance criteria:**

- [ ] At most one active recovery exists per user and a terminal recovery cannot become active again.
- [ ] Cancellation/promotion challenges are recovery-bound, five-minute, digest-only, purpose-bound,
  one-time, and attempt-limited.
- [ ] Existing family-level provenance remains the only session/token restriction representation.

**Test plan:**

- [ ] Migration integration tests cover foreign keys, checks, partial uniqueness, indexes, and
  up/down behavior.
- [ ] Repository tests cover terminal-state conflicts and challenge invalidation.

**Verification:**

    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Task 1.

### Task 3: Cancel recovery with a trusted passkey

**Description:** Implement trusted-only cancellation from identified login and the explicit
authenticated-device ceremony, and apply the same transition to trusted usernameless login.

**Acceptance criteria:**

- [ ] Only an active trusted credential belonging to the account can cancel recovery.
- [ ] Cancellation options are unavailable once the fixed restriction period has ended.
- [ ] Cancellation revokes the provisional credential and every recovery-derived family, refresh
  generation, and access session atomically.
- [ ] A trusted account-bound or usernameless login cancels recovery before issuing its normal
  session.
- [ ] A provisional credential, session, refresh token, email, OTP, or limited authorization cannot
  cancel recovery.

**Test plan:**

- [ ] Service and adapter tests cover trusted, provisional, cross-account, revoked, and unknown
  credentials, exact options allowlists, and the restriction-end boundary.
- [ ] Repository integration tests prove atomic revocation, event/outbox insertion, races, rollback,
  and replacement-session issuance.
- [ ] HTTP tests assert cookie replacement, no-store, origin rejection, and stable errors.

**Verification:**

    npx nx run backend:test
    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Task 2.

### Task 4: Promote after a fresh day-five assertion

**Description:** Implement the promotion ceremony and global family/session revocation.

**Acceptance criteria:**

- [ ] Only the active recovery's provisional credential can appear in promotion options.
- [ ] The clock check is server-authoritative and promotion requires a fresh assertion at or after
  restrictionEndsAt.
- [ ] Promotion marks the credential trusted, retains other passkeys, revokes all prior families,
  refresh generations, and access sessions, then creates exactly one unrestricted replacement family
  and session.

**Test plan:**

- [ ] Boundary tests run one millisecond before, exactly at, and after restrictionEndsAt.
- [ ] Repository integration tests prove global revocation, replacement issuance, cancellation race,
  replay rejection, events/outbox, and rollback.
- [ ] Session restoration/refresh tests prove that only the replacement lineage is unrestricted.

**Verification:**

    npx nx run backend:test
    npx nx run backend:test:integration
    npx nx run backend:typecheck

**Dependencies:** Tasks 2–3.

### Task 5: Add typed API-client operations

**Description:** Add schema-validated recovery-status, cancellation, and promotion clients and
query/mutation options.

**Acceptance criteria:**

- [ ] Calls use credentialed fetch and strict schemas.
- [ ] State-changing calls and WebAuthn verification use retry: false.
- [ ] Expected lifecycle conflicts and availability failures remain distinguishable without cookie
  inspection.

**Test plan:**

- [ ] Client tests assert method/path/body, credentials, parsing, Retry-After, and every stable
  error.
- [ ] Tests prove no automatic replay of cancellation or promotion verification.

**Verification:**

    npx nx run @calibrate/api-client:test
    npx nx run @calibrate/api-client:typecheck

**Dependencies:** Tasks 1, 3, and 4.

### Task 6: Build recovery lifecycle UI and prove the flow

**Description:** Add the trusted cancellation alert, promotion ceremony, end-to-end coverage, and
ADR-0003 documenting the full provisional recovery lifecycle.

**Acceptance criteria:**

- [ ] An unrestricted session can request trusted cancellation but never cancels from session
  possession alone.
- [ ] A restricted session has no self-cancel action and exposes promotion only after server status
  reports eligibility.
- [ ] Lost responses, conflicts, and availability failures preserve state and never replay a WebAuthn
  response.
- [ ] ADR-0003 records immediate access, family provenance, trusted cancellation, promotion timing,
  global family revocation, retained passkeys, and notification-outbox rationale.

**Test plan:**

- [ ] Component and browser-adapter tests cover cancellation, promotion eligibility, fresh
  ceremonies, accessibility, ambiguous outcomes, and post-transition navigation.
- [ ] Backend/web integration tests use fake email, injected time, and fake WebAuthn for trusted
  cancellation and before/at/after-day-five promotion.
- [ ] Manual two-browser check: browser A creates recovery access; browser B cancels with a trusted
  passkey; separately verify promotion revokes browser B after five days.

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

**Dependencies:** Tasks 3–5.

## Final checkpoint

- [ ] A trusted passkey can cancel an active recovery but no ordinary credential can.
- [ ] Cancellation revokes the provisional credential and its entire family/session lineage.
- [ ] Promotion requires a fresh provisional-passkey assertion after five complete server-timed days.
- [ ] Promotion retains passkeys but revokes every prior family, refresh token, and access session.
- [ ] Exactly one unrestricted replacement family/session is issued after promotion.
- [ ] Cancellation and promotion are serialized, auditable, notified through the outbox, and safe
  after an ambiguous response.

## Explicitly deferred

- A general central policy and route inventory for all takeover-sensitive operations.
- General credential-management UI, selective device management, recovery-email changes, additional
  recovery factors, native-client transport, and support-agent recovery.
- Restricting ordinary account reads or writes during the five-day period.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Provisional assertion cancels its own restriction | Critical | Trusted-only allowlist and server credential provenance checks. |
| Promotion occurs early or without user presence | Critical | Fixed injected-clock check and one-time, UV-required assertion. |
| Global revocation leaves an old session usable | Critical | One repository transaction revokes all families, generations, and sessions before replacement issuance. |
| Cancellation and promotion race | High | Lock/conditional-write the active recovery and provisional credential; exactly one terminal transition commits. |
| Lost WebAuthn response causes replay | High | Read session/status after ambiguity; never replay attestation or assertion. |

## References

- [NIST SP 800-63B: Account Recovery](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery)
- [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

## Open questions

None. Trusted-passkey cancellation, fresh-assertion promotion after the fixed five-day window,
global family/session revocation on promotion, and retaining other passkeys are locked decisions.
