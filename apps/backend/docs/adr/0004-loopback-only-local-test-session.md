# ADR-0004: Provide a loopback-only local test-session shortcut

## Status

Accepted

## Date

2026-08-16

## Context

Manual review of authenticated pages should not require a reviewer to register
a native passkey with the host operating system. The existing local signup
shortcut in ADR-0003 intentionally exercises the real WebAuthn ceremony, but
that makes it the wrong tool for quickly inspecting a dashboard or protected
page.

## Decision

Expose `POST /api/v1/auth/local-development/test-session` for local manual
verification. The route:

- reuses the local-development guard and returns `404` unless the runtime is
  non-production, the configured WebAuthn origin is an HTTP loopback origin,
  the raw `Origin` header exactly matches that configured origin, and the raw
  socket peer is loopback;
- atomically creates or reuses the reserved
  `local-test-session@example.test` user and creates a new remembered-device
  family, refresh generation, and access session on every request;
- uses the existing opaque token generator, digest-only persistence,
  transaction boundary, and access/refresh cookie writer;
- returns only the ordinary authenticated-user response while placing raw
  access and refresh values in `HttpOnly` cookies; and
- records neither a passkey credential nor recent passkey authentication.

The browser button is rendered only in development builds on a loopback
hostname. It calls the route from the app origin with the existing credentialed
API transport, then navigates to the authenticated application. The server
guard remains authoritative; the UI condition is only a usability boundary.

## Alternatives considered

### Seed browser cookies or return bearer values to the frontend

Rejected: this would bypass the normal session persistence and cookie contract,
and would expose credentials to JavaScript, URLs, or browser-readable storage.

### Add a CI header, query parameter, or client environment flag

Rejected: client-controlled signals and forwarded headers cannot safely open a
remote authentication shortcut. The route must be structurally loopback-only.

### Reuse the local passkey-enrollment route

Rejected: manual page inspection does not need a WebAuthn registration
ceremony. Combining the paths would either create a passkey as a side effect or
weaken the meaning of the real passkey flow.

## Consequences

- A local human or agent browser can inspect authenticated pages using normal
  server-set cookies without writing a native passkey.
- Each click creates a fresh session/device/refresh generation for one
  disposable fixture identity; old local generations remain server state until
  normal expiry or cleanup.
- The local session is ordinary authentication for page access only. It does
  not satisfy recent passkey re-authentication, so sensitive operations still
  require the real passkey or recovery flow.
- Production, staging, public preview, non-loopback, wrong-origin, missing-
  origin, and non-loopback-peer requests cannot create the fixture or session.
