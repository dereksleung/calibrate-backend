# Implementation Plan: Unified Email Entry and Post-OTP Routing

## Outcome and scope

Create the smallest complete vertical slice that turns the existing signup-only email path into a
unified email entry path for signup, login, and recovery:

1. `/signup-login` continues to offer conditional and explicit passkey login.
2. Its email form uses a neutral **Continue with email** action.
3. Submitting the email requests the same privacy-preserving OTP ceremony whether or not an account
   exists.
4. Only after successful OTP verification does the backend resolve the verified email to one of two
   continuations:
   - a new email receives the existing short-lived signup enrollment authorization and continues to
     `/auth/passkey-enrollment`;
   - an existing email continues to a new `/auth/login-recovery` placeholder.

This slice stops at the placeholder. It does not implement passkey selection for the identified
account, email recovery authorization, the five-day recovery cool-off, adding a recovered passkey,
session creation through recovery, or credential revocation. Those are the subject of the next plan.

The placeholder is an integration seam, not a production-complete recovery experience. Do not
represent arrival there as authentication or recovery authorization.

## Current-state assessment

- `SignupLoginPage.tsx` already starts privacy-preserving conditional passkey authentication and
  offers an explicit passkey button.
- Its email form and supporting copy are still signup-specific, and the submit button says
  **Sign Up**.
- `POST /api/v1/auth/email-verification` already has a neutral URL, but its API symbols,
  application service, email sender operation, purpose naming, and tests are signup-specific.
- `POST /api/v1/auth/email-verification/verify` always creates a signup enrollment authorization,
  sets the passkey-enrollment cookie, and returns `next: "passkey-registration"`.
- `OtpPage.tsx` always navigates to `/auth/passkey-enrollment` and tells every user that they will
  create a passkey.
- The existing `signup_enrollment_authorizations` table and passkey-registration endpoints should
  remain new-account-only.

## Locked decisions

### Preserve privacy before email control is proven

- Keep the existing request paths:
  - `POST /api/v1/auth/email-verification`
  - `POST /api/v1/auth/email-verification/verify`
- Generalize their contract and implementation names from `SignupEmailVerification` to
  `AccountEmailVerification`; changing the already-neutral URLs adds no value.
- The request endpoint must not query account existence for client-visible behavior or return an
  `accountExists`, `hasPasskeys`, `next`, credential ID, or account-specific timing/status signal.
- Request and resend responses remain identical for new and existing emails and retain the existing
  rate limits, delivery behavior, generic errors, client binding, expiry, and
  `Cache-Control: no-store` behavior.
- The existing conditional WebAuthn ceremony remains independent. Its pending state means the
  browser is listening; it must never disable **Continue with email** or be treated as evidence that
  a passkey exists.

### Branch only after successful OTP verification

The verified response becomes a strict discriminated union:

```ts
type VerifyAccountEmailVerificationResponse =
  | {
      next: "passkey-registration";
      expiresAt: string;
    }
  | {
      next: "login-or-recovery";
    };
```

- The backend resolves the email stored on the consumed OTP challenge; it does not accept an email
  from the verification request.
- For a new email, verification retains the current behavior: atomically consume the OTP challenge,
  create a five-minute signup enrollment authorization, set the path-scoped enrollment cookie, and
  return `next: "passkey-registration"`.
- For an existing email, verification atomically consumes the OTP challenge, creates no signup
  enrollment authorization, clears any stale signup-enrollment cookie using its exact cookie
  attributes, and returns `next: "login-or-recovery"`.
- Returning `login-or-recovery` after successful proof of control is an intentional disclosure to
  the inbox controller. It must not be observable from the request endpoint or an invalid OTP.
- Neither branch creates an authenticated session. The existing-account branch also creates no
  recovery authorization in this slice.

### Keep the account-resolution transaction authoritative

Replace the signup-only OTP-consumption operation with a continuation-oriented repository port. Its
PostgreSQL transaction should:

1. conditionally consume the still-active, correctly bound OTP challenge;
2. obtain the normalized email from that challenge;
3. check the `users` table for that normalized email;
4. return the existing-account branch without creating signup state, or invalidate prior active
   signup enrollment authorizations and create the new one; and
5. roll back the challenge consumption if any required write fails.

The `users.email` unique constraint remains the final protection against a concurrent signup race.
If another request creates the account after this transaction resolves the email as new, later
passkey-registration completion must continue to fail safely with its existing state-conflict
behavior. Do not weaken the unique constraint or silently attach a new credential to the now-existing
account.

### Treat frontend route state as display metadata only

- Rename the current signup-specific handoff helpers to neutral account-email-verification names.
- After verification, build one of two strict metadata-only handoffs:
  - passkey enrollment: normalized email, `next`, and `expiresAt`;
  - login/recovery placeholder: normalized email and `next`.
- Do not put an OTP, enrollment token, account ID, user ID, credential ID, or recovery secret in
  TanStack Router state, query parameters, URLs, local storage, or logs.
- The new placeholder route validates its handoff and redirects a direct or malformed visit to
  `/signup-login`.
- The handoff is not authorization. The future recovery implementation must require a server-held,
  narrowly scoped recovery authorization rather than trusting this client state.

## Target flow

```text
/signup-login
  |-- conditional/explicit passkey selected --> existing passkey login --> /
  |
  `-- Continue with email
        --> POST /auth/email-verification
        --> /auth/otp
              --> POST /auth/email-verification/verify
                    |-- invalid/expired code --> generic error; remain on OTP page
                    |-- new email
                    |     --> set signup-enrollment cookie
                    |     --> next: passkey-registration
                    |     --> /auth/passkey-enrollment
                    `-- existing email
                          --> clear stale signup-enrollment cookie
                          --> next: login-or-recovery
                          --> /auth/login-recovery placeholder
```

## Public API contract

### Request or resend account-email verification

`POST /api/v1/auth/email-verification`

Request:

```json
{
  "email": "person@example.com"
}
```

Successful response remains `202`:

```json
{
  "challengeId": "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
  "expiresInSeconds": 600,
  "resendAfterSeconds": 60
}
```

This response is deliberately account-neutral.

### Verify account-email control and resolve the continuation

`POST /api/v1/auth/email-verification/verify`

Request remains:

```json
{
  "challengeId": "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
  "code": "012345"
}
```

New-account response:

```json
{
  "next": "passkey-registration",
  "expiresAt": "2030-01-01T00:05:00.000Z"
}
```

Existing-account response:

```json
{
  "next": "login-or-recovery"
}
```

Both responses use `200` and `Cache-Control: no-store`. Invalid request shapes, invalid or expired
codes, consumed challenges, binding mismatches, and attempt exhaustion retain the same generic
failure behavior. Account lookup or persistence failures return an availability error and must not
be converted into either continuation.

## UI content and behavior

### `/signup-login`

Show:

- the existing **Sign Up or Log In** heading;
- neutral guidance such as “Enter your email and we’ll send a code to continue”;
- email input;
- **Continue with email** / **Sending code…** button states;
- conditional passkey suggestions and the explicit **Log in with passkey** action.

Do not show:

- whether the email exists;
- whether the account has passkeys;
- signup-only promises before the OTP is verified;
- a disabled email action merely because conditional WebAuthn is pending.

Submitting email should continue to cancel the active conditional WebAuthn request before starting
the email ceremony so the browser prompt does not compete with navigation.

### `/auth/otp`

Show:

- the normalized destination email;
- code expiry and resend timing;
- neutral copy explaining that verification will continue account setup or account access;
- the existing validation, pending, resend, and safe error states.

Do not show which continuation will be selected before the server accepts the code.

### `/auth/login-recovery` placeholder

Show:

- “Email verified”;
- the normalized email from the validated handoff;
- explicit placeholder copy that passkey login and email recovery options will be implemented in the
  next slice;
- a safe action back to `/signup-login`.

Do not show:

- an authenticated state;
- a recovery countdown or five-day cool-off start time;
- registered passkeys or credential details;
- controls that imply recovery, session issuance, or passkey changes have already been authorized.

## Story and branch structure

Create the story integration branch before implementation:

```text
codex/unified-email-auth-entry
```

Create each subtask branch from the story branch unless it depends on an unmerged subtask:

```text
codex/unified-email-auth-entry/contracts
codex/unified-email-auth-entry/backend-resolution
codex/unified-email-auth-entry/frontend-entry-otp
codex/unified-email-auth-entry/frontend-placeholder
codex/unified-email-auth-entry/integration-docs
```

Each task is a commit and review checkpoint. Inspect the diff before switching branches or opening a
PR. Open PRs to the story branch at the required gates: immediately after Task 1 (`api-contracts`),
after Task 2 (backend), after Tasks 3–4 (frontend), and after Task 5 (wiring/documentation).

## Implementation tasks

### Task 1: Generalize the shared email-verification contract and API client

**Description:** Replace signup-specific public TypeScript names with account-email-verification
names while keeping the existing neutral URLs. Change the verification success schema to the strict
`next` union above, and update API-client operations and mutation keys accordingly.

**Acceptance criteria:**

- [ ] Request and verification schemas remain strict and continue normalizing the submitted email.
- [ ] The request response contains no account or passkey status.
- [ ] The verify response accepts exactly the two documented continuation variants and rejects
  mixed, missing, token-shaped, or extra fields.
- [ ] API-client operations use `credentials: "include"`, do not retry verification automatically,
  and expose neutral account-email-verification names.
- [ ] No compatibility alias keeps the misleading signup-only public API unless a known external
  consumer is discovered during implementation.

**Test plan:**

- [ ] Contract unit tests accept both exact verify variants and reject `accountExists`, `userId`,
  credential material, an `expiresAt` on `login-or-recovery`, and missing `expiresAt` on
  `passkey-registration`.
- [ ] API-client tests assert the unchanged HTTP paths/methods, credential inclusion, normalized
  request body, parsing for both continuations, and safe failure propagation.
- [ ] Search-based regression check confirms web and backend source no longer import the removed
  signup-specific contract/client names.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
npx nx run @calibrate/api-client:typecheck
```

**Dependencies:** None.

**Files likely touched:**

- `packages/api-contracts/src/auth-requests.ts`
- `packages/api-contracts/src/auth-responses.ts`
- `packages/api-contracts/src/auth-contracts.test.ts`
- `packages/api-client/src/auth/signup-email-verification.ts` (rename to a neutral filename)
- API-client tests and package indexes

**Estimated scope:** M.

### Task 2: Resolve new versus existing accounts after OTP verification

**Description:** Generalize the application service, sender operation, controller naming, and
OTP-consumption repository so valid email proof produces the appropriate continuation. The
repository owns the cross-table transaction; presentation owns cookie setting/clearing and response
mapping.

**Acceptance criteria:**

- [ ] Request/resend sends neutral account-access email content and has identical public behavior for
  new and existing emails.
- [ ] Account existence is checked only after the code matches and the transaction successfully
  claims the active challenge.
- [ ] The new-account branch creates exactly one signup enrollment authorization and returns its raw
  token only to presentation for the `HttpOnly` cookie.
- [ ] The existing-account branch consumes the OTP exactly once, creates no enrollment/session
  state, returns no user identifier, and clears a stale enrollment cookie.
- [ ] A transaction failure rolls back OTP consumption; concurrent verification cannot produce two
  successful continuations from one challenge.
- [ ] Existing rate limits, HMAC verification, attempt counting, client transport binding, origin
  behavior, generic errors, and `no-store` headers remain intact.

**Test plan:**

- [ ] Application unit tests cover valid new email, valid existing email, invalid code, expired or
  consumed challenge, binding mismatch, and repository conflict/unavailability.
- [ ] Repository integration tests prove both branches, one-time atomic consumption, rollback on
  failure, invalidation of prior new-account enrollment authorizations, and no enrollment row for an
  existing account.
- [ ] Controller and HTTP integration tests assert the exact response union, cookie issuance only for
  new accounts, exact stale-cookie clearing for existing accounts, identical pre-verification
  request responses, and absence of secrets/account IDs.
- [ ] Email adapter tests assert the message no longer tells an existing user they are signing up.

**Verification:**

```sh
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
```

**Dependencies:** Task 1.

**Files likely touched:**

- `apps/backend/src/application/services/signup-email-verification-service.ts` (rename/generalize)
- `apps/backend/src/application/ports/signup-enrollment-authorization-repository.ts`
  (replace with a continuation-oriented port)
- `apps/backend/src/infrastructure/persistence/repositories/postgres-signup-enrollment-authorization-repository.ts`
- `apps/backend/src/presentation/controllers/auth-controller.ts`
- `apps/backend/src/infrastructure/container.ts`, email sender adapter, and focused tests

**Estimated scope:** M per layer; split repository/service and presentation wiring into separate
commits on the same subtask branch if the diff exceeds five focused files.

### Task 3: Make email entry and OTP copy neutral and branch on `next`

**Description:** Update the existing pages and handoff helpers to use the generalized API client.
Keep passkey login behavior unchanged. After OTP verification, navigate to passkey enrollment or the
login/recovery route strictly from the parsed server response.

**Acceptance criteria:**

- [ ] The email action says **Continue with email** and pending copy says **Sending code…**.
- [ ] Page and OTP copy describe both setup and account access without disclosing the branch early.
- [ ] A pending conditional passkey ceremony does not disable email submission; submitting email
  cancels that ceremony as it does today.
- [ ] `passkey-registration` produces only the existing enrollment handoff and navigation.
- [ ] `login-or-recovery` produces only the existing-account placeholder handoff and navigation.
- [ ] Invalid response data, network errors, and invalid OTPs show safe messages and do not navigate.

**Test plan:**

- [ ] Component tests assert neutral labels/copy, validation, disabled-during-email-request behavior,
  and independence from conditional WebAuthn pending state.
- [ ] OTP component tests cover each `next` variant and assert the exact route and metadata-only
  history state.
- [ ] Handoff unit tests accept normalized exact state and reject extra fields, missing fields,
  tokens, IDs, and the wrong continuation.
- [ ] Existing conditional and explicit passkey-login tests continue to pass unchanged except for
  text assertions intentionally updated by this task.

**Verification:**

```sh
npx nx run web:test
npx nx run web:typecheck
```

**Dependencies:** Task 1 and the Task 2 response contract.

**Files likely touched:**

- `apps/web-frontend/src/pages/auth/SignupLoginPage.tsx`
- `apps/web-frontend/src/pages/auth/OtpPage.tsx`
- `apps/web-frontend/src/verticals/auth/signup-email-verification-handoff.ts` (rename/generalize)
- their focused unit tests

**Estimated scope:** M.

### Task 4: Add the guarded login/recovery placeholder route

**Description:** Add a minimal auth-shell page and route for the existing-account branch. It proves
the complete routing slice without implementing or pretending to implement recovery authority.

**Acceptance criteria:**

- [ ] `/auth/login-recovery` renders only with a valid `login-or-recovery` handoff.
- [ ] Direct, refreshed, malformed, or wrong-branch visits redirect to `/signup-login`.
- [ ] The root layout treats the new route as an auth route, with no authenticated header/footer or
  session-restoration gate.
- [ ] The page states that email is verified but does not claim login, recovery authorization, or
  cool-off activation.
- [ ] Its back action returns to `/signup-login` and leaves no sensitive URL state.

**Test plan:**

- [ ] Page tests cover visible verified-email/placeholder copy and the back action.
- [ ] Route integration tests cover valid handoff, direct visit, malformed state, and wrong
  continuation.
- [ ] Root-layout regression test verifies the placeholder uses the same unauthenticated auth shell
  as OTP and passkey enrollment.

**Verification:**

```sh
npx nx run web:test
npx nx run web:test:integration
npx nx run web:typecheck
```

**Dependencies:** Task 3.

**Files likely touched:**

- `apps/web-frontend/src/pages/auth/LoginRecoveryPage.tsx`
- `apps/web-frontend/src/pages/auth/LoginRecoveryPage.test.tsx`
- `apps/web-frontend/src/routes/auth/login-recovery.tsx`
- `apps/web-frontend/src/routes/__root.tsx`
- focused routing integration tests

**Estimated scope:** M.

### Task 5: Prove both vertical paths and update the governing documentation

**Description:** Add cross-boundary regression coverage for request, OTP verification, and routing,
then update ADR-0002 to record the unified entry decision and the explicit recovery deferral.

**Acceptance criteria:**

- [ ] A new email follows request -> OTP -> enrollment cookie -> passkey-enrollment route.
- [ ] An existing email follows the indistinguishable request -> OTP -> no enrollment cookie ->
  login/recovery placeholder route.
- [ ] Before valid OTP proof, status, response shape, and user-facing UI do not disclose which path
  will be chosen.
- [ ] The registration flow remains new-account-only and passkey login remains independently usable.
- [ ] ADR-0002 explains that email OTP now resolves a continuation after proof, while email recovery,
  the five-day cool-off, and recovery-authorized credential management remain deferred.

**Test plan:**

- [ ] Backend HTTP integration tests drive both emails through the real request and verify routes
  using the fake email sender's captured OTP.
- [ ] Web integration tests mock the HTTP boundary and prove both route sequences, normalized
  handoffs, credentialed requests, no URL leakage, and direct-route rejection.
- [ ] Regression tests confirm passkey enrollment still requires its path-scoped cookie and
  conditional passkey login can still complete from `/signup-login`.
- [ ] Manual accessibility check covers focus progression, screen-reader button names, OTP errors,
  and the placeholder's back action.

**Verification:**

```sh
npx nx run @calibrate/api-contracts:test
npx nx run @calibrate/api-client:test
npx nx run backend:test
npx nx run backend:test:integration
npx nx run backend:typecheck
npx nx run web:test
npx nx run web:test:integration
npx nx run web:typecheck
npx nx run backend:fmt:check
npx nx run web:fmt:check
```

**Dependencies:** Tasks 1–4.

**Files likely touched:**

- `apps/backend/src/presentation/routes/__tests__/auth-routes.integration.test.ts`
- `apps/web-frontend/src/pages/auth/signup-email-verification.integration.test.tsx`
  (rename/generalize)
- `apps/web-frontend/src/pages/auth/passkey-signup.integration.test.tsx`
- `apps/backend/docs/adr/0002-email-otp-and-cookie-backed-server-sessions.md`

**Estimated scope:** M.

## Checkpoint: Unified email-entry slice complete

- [ ] Conditional and explicit passkey login still work from `/signup-login`.
- [ ] Email submission is always available and uses neutral, non-enumerating UI/API behavior.
- [ ] A verified new email reaches the existing passkey-registration flow with its enrollment cookie.
- [ ] A verified existing email reaches only the guarded login/recovery placeholder and receives no
  session, recovery authority, or signup enrollment cookie.
- [ ] Invalid OTP and direct-route attempts reveal no account status.
- [ ] All focused contract, client, backend, and web checks pass.
- [ ] Story diff contains no unrelated changes, especially the pre-existing modifications to
  `postgres-access-session-repository.ts` and `session-restoration-gate.tsx`.

## Explicitly deferred to the next plan

- Identifier-first authentication options for the verified existing account, including
  `allowCredentials` behavior and explicit passkey selection UI.
- A server-held recovery authorization derived from verified email control.
- Recovery confirmation UX and starting the five-day cool-off period.
- Notifications, cancellation, audit/security events, and status polling during cool-off.
- Registering a replacement passkey after cool-off.
- Restrictions on the new recovery-created passkey and eventual authority to revoke older passkeys
  or remembered-device families.
- Recovery session issuance, replay/conflict handling, and recovery-cookie lifecycle.
- Reload/resume behavior for an in-progress login/recovery authorization.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Account enumeration moves before OTP proof | High | Keep request/resend account-neutral; resolve and return `next` only after valid OTP consumption. |
| Existing account accidentally receives signup authority | High | Make resolution and challenge consumption one repository transaction; create enrollment state only in the new branch and clear stale cookies in the existing branch. |
| Placeholder is mistaken for recovery authorization | High | State the boundary in API types, UI copy, tests, and ADR; issue no recovery credential or session. |
| Conditional WebAuthn blocks email fallback | Medium | Keep its listening state local to passkey UI and explicitly test that email submission remains enabled. |
| Concurrent signup changes account state after routing | Medium | Preserve unique email enforcement and existing registration conflict behavior; never attach a credential based only on client routing state. |
| Signup-specific names survive and mislead later work | Medium | Rename public contracts, client operations, service, sender operation, handoffs, and tests; retain only the signup-specific enrollment and registration concepts that truly remain signup-only. |
| Dead-end placeholder is deployed as complete recovery | Medium | Treat this as a development integration slice and keep production enablement blocked on the follow-up login/recovery plan. |

## Open questions

None for this slice. The five-day cool-off semantics and the authority granted to a
recovery-created passkey remain intentionally open for the next login/recovery plan.
