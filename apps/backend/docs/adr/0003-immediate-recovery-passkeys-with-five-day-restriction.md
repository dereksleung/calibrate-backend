# ADR-0003: Immediate recovery passkeys with a five-day restriction

## Status

Accepted

## Date

2026-08-05

## Context

Email control is the recovery assurance floor for an existing Calibrate account. Requiring a delay
before all access would reduce immediate account takeover risk, but would also lock out a person
who has lost an authenticator and still controls their verified email.

The recovery flow must preserve existing trusted passkeys and sessions so a legitimate owner can
detect and cancel a malicious recovery. It must also prevent a new email-recovery passkey from
immediately obtaining durable takeover authority.

## Decision

After verified email control and successful WebAuthn registration, issue a provisional passkey and
a recovery-bound restricted session immediately. The recovery record stores a fixed server-time
restriction end of registration time plus five days. Every family created from that passkey keeps
the recovery provenance; refresh cannot remove it.

While restricted, the session may use ordinary account features but must not satisfy
takeover-sensitive authorization. A trusted existing passkey assertion cancels the recovery and
revokes only the provisional credential and its derived families. At or after the fixed timestamp,
the provisional passkey must complete a fresh promotion assertion. Promotion trusts that credential,
revokes all families/sessions, and creates one unrestricted replacement family.

Recovery and notification state are written together in PostgreSQL; the outbox carries only
non-secret timestamps and event metadata. Raw authorization tokens and WebAuthn challenges remain
digest-only and cookie-bound.

## Consequences

- A verified-email claimant receives immediate ordinary access. This is an intentional trade-off,
  not phishing-resistant account proof.
- For five days, sensitive actions must use a centralized server-side restriction policy; UI
  messaging is explanatory only.
- Existing trusted credentials remain available to the original owner for recovery cancellation.
- New high-impact product features must be explicitly classified before release. Financial,
  clinical, regulated, administrative, bulk-export, credential-management, and recovery-email
  features require re-evaluation of this decision.
