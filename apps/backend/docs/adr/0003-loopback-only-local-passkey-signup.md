# ADR-0003: Provide a loopback-only local passkey signup shortcut

## Status

Accepted

## Date

2026-08-09

## Context

The normal web signup flow verifies control of a recovery email before allowing
the first passkey to be registered. A hiring manager running the repository
locally cannot complete that step because the local backend does not have the
Brevo credential and a copied credential would not be authorized from the
manager's IP address.

The existing passkey enrollment page already performs the complete WebAuthn
registration ceremony, so local development only needs a safe way to create
its short-lived enrollment authorization.

## Decision

Expose a local-development enrollment endpoint that creates a five-minute,
single-use enrollment authorization for a generated `@example.test` address.
The endpoint:

- is available only when the configured WebAuthn origin is an HTTP loopback
  origin (`localhost`, `127.0.0.1`, or `::1`);
- requires the exact configured `Origin` header and a loopback client address;
- is denied in production, without setting an enrollment cookie; and
- returns only the generated email, continuation type, and expiry. The opaque
  enrollment token remains in the existing `HttpOnly` enrollment cookie.

The web button is compiled into development builds but rendered only on a
loopback hostname. It navigates into the existing passkey enrollment route and
does not alter the email-OTP signup or recovery paths.

The generated address is disposable local data, not a usable recovery address.
It is intentionally reserved under `example.test`, and the UI explains why
the bypass exists.

## Alternatives considered

### Ask the user to enter a real email

Rejected for this shortcut: it would still require email delivery or create a
second local-only OTP mechanism, while the purpose is to let a reviewer test
the repository without a mail provider.

### Expose the endpoint whenever `NODE_ENV` is not production

Rejected: a non-production environment flag alone is not a sufficient boundary.
The endpoint additionally requires a loopback WebAuthn origin and loopback
client address.

### Put the enrollment token in the JSON response

Rejected: the existing cookie-backed enrollment boundary is retained so the
token is not exposed to JavaScript or URL state.

## Consequences

- Local reviewers can create a disposable account and verify the real passkey
  registration flow without Brevo.
- Local disposable accounts cannot recover access through email; they should
  be deleted and recreated when needed.
- Production signup still requires verified email control.
- The loopback checks are defense in depth; a local backend should still be
  bound and exposed only as intended by its development setup.
