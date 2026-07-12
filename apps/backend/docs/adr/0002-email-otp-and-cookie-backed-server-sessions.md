# ADR-0002: Use email OTP and cookie-backed server sessions

## Status

Accepted

## Date

2026-07-12

## Context

The backend currently creates users with passwords, hashes those passwords with Argon2, authenticates email/password credentials, and issues signed JWT bearer access tokens. Protected routes validate the bearer token and recover the user ID from its subject claim.

Calibrate is a first-party consumer application whose primary authenticated workflow is recording food throughout the day. A common usage pattern is to record dinner, close the application, and return the next morning to record breakfast. Requiring a new login every day would add friction at the moment the product needs to be fastest.

The application does not currently need independent services, third-party API consumers, or multiple technology stacks to validate access tokens without contacting a shared session store. It does need durable login across browser restarts, server-side revocation, straightforward logout, and a unified signup/login experience without password management.

Email OTP is lower assurance than a passkey or properly configured multi-factor flow because control of the email inbox grants control of the Calibrate account. That trade-off is acceptable for the current consumer food-logging scope, but it must be explicit and must not be represented as multi-factor authentication.

ADR-0001 lists Argon2 and jose JWTs as examples of infrastructure technologies. This ADR supersedes those authentication-specific examples. It does not supersede ADR-0001's clean architecture, domain boundaries, dependency direction, or transaction ownership decisions.

## Decision

### Authentication method

Use one passwordless email OTP flow for both signup and login.

The backend creates a short-lived authentication challenge for a normalized email address and sends a numeric code through an email-sender port. When the code is verified, the backend creates a user if that email is new or loads the existing user if it is already registered. User creation never occurs before email control is proven.

The completed migration removes password credentials, password hashing, password login, JWT issuance, and bearer-token verification from the end-user authentication path. Existing users and their domain data remain; they authenticate by email OTP on their next login.

### OTP challenge model

An OTP challenge is server-side state with a random public identifier, normalized email, purpose, code digest, HMAC format version, HMAC key version, attempt count, expiration, and consumption/invalidation state.

Codes are six numeric digits generated through a cryptographically secure random-number generator. Challenges expire after 10 minutes, permit at most five attempts, and are single use. A new code can be requested after a 60-second cooldown and invalidates older unconsumed authentication challenges for the same email.

The database never stores the plaintext code. It stores an HMAC-SHA-256 digest over a structured message that binds the authentication namespace, format version, purpose, challenge identifier, and code. Binding the digest to the challenge prevents digest correlation when two challenges receive the same numeric code and prevents using a digest under a different challenge or purpose.

The HMAC key is an independently generated 32-byte server secret stored outside the database and source repository. Key and format versions are persisted with each challenge so verification can support a controlled transition. Backend replicas in one environment share the environment's key; development, staging, and production use different keys.

HMAC is defense against a database-only compromise, not a substitute for online controls. Short expiration, atomic single use, strict attempt accounting, resend invalidation, and shared rate limits remain mandatory.

### Session model

After successful OTP verification, create an opaque server-side session. Generate a session token with at least 256 bits of cryptographically secure randomness, store only its digest in PostgreSQL, and send the raw token only as a persistent browser cookie.

The production cookie uses a `__Host-` name, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute. The token is not returned in JSON and is not stored in local storage or session storage.

Sessions have a 30-day inactivity lifetime and a 180-day absolute lifetime. While a session remains valid, normal use may extend the inactivity expiration and cookie lifetime at most once per day. Renewal never extends the absolute expiration and does not require a refresh token or another OTP.

The first implementation does not rotate the opaque token periodically. It issues a new token after authentication and security-sensitive identity changes. Concurrent-safe periodic rotation may be introduced later if the threat model justifies the added race-handling complexity.

PostgreSQL session state is authoritative. Missing, expired, revoked, or absolutely expired sessions are rejected. Logout revokes the current session and clears the cookie. Multiple sessions per user are allowed so separate devices do not invalidate one another.

### HTTP API

Expose these authentication operations under the existing API version:

- `POST /auth/email-otp` creates and delivers an authentication challenge.
- `POST /auth/email-otp/verify` verifies a challenge, returns the current user, and sets the session cookie.
- `GET /auth/session` validates the cookie and returns the current user.
- `DELETE /auth/session` revokes the current session and clears the cookie idempotently.

Authentication JSON responses do not contain access tokens or refresh tokens. Shared request and response schemas remain owned by the API-contract package.

Protected HTTP routes continue to receive an authenticated user ID through the existing request authentication context. Replacing the middleware credential source must not change day-log ownership checks.

Cookie-authenticated cross-origin requests require a configured frontend-origin allowlist and credentialed CORS. Authenticated state-changing requests validate the request origin, with `SameSite=Lax` providing an additional CSRF boundary.

### Architecture and transaction ownership

Application services coordinate challenge request, challenge verification, user lookup or creation, session creation, session validation, renewal, and revocation through ports.

Presentation owns HTTP validation, status codes, cookie creation and clearing, origin validation, and mapping application results to shared contracts. Infrastructure owns PostgreSQL repositories, Node cryptography, email delivery, shared rate-limit persistence, and secret loading.

Repositories own database transactions in accordance with ADR-0001. Attempt increments, successful challenge consumption, and session renewal use conditional atomic persistence so concurrent requests cannot bypass limits or consume one challenge twice.

The primary behavioral test seam is the HTTP application with an injected fake email sender and controlled persistence. Lower-level tests cover concurrency, expiration, key selection, and database behavior that cannot be observed reliably through one HTTP journey.

### Abuse controls and operations

OTP requests are limited by normalized email, requesting IP, resend cooldown, and a global delivery ceiling. Limits must be shared across backend replicas; process-memory-only limiting is not sufficient for production.

Authentication responses do not reveal whether an email already belongs to a user. Invalid challenge states use a generic invalid-or-expired-code response. Internal events may distinguish outcomes for operations, but logs never include OTP codes, raw session tokens, HMAC keys, or complete cookie values.

Expired challenges, expired or revoked sessions, and obsolete rate-limit records are subject to retention cleanup.

## Alternatives Considered

### Keep passwords and JWT bearer tokens

Pros:

- Reuses the existing implementation.
- JWT verification does not require a database lookup.

Cons:

- Retains password creation, reset, breach, and credential-stuffing concerns.
- Does not by itself provide the durable browser-session lifecycle the product needs.
- Immediate logout and revocation require additional server-side state or a denylist.
- Requires the browser client to manage bearer-token transport securely.

Rejected because the application values low-friction first-party browser sessions more than stateless bearer-token validation.

### Use a single long-lived JWT

Pros:

- Simple request verification.
- No session database lookup.

Cons:

- A stolen token remains useful for its full lifetime.
- Server-side logout, revocation, inactivity expiration, and device-session management are difficult without reintroducing state.

Rejected because long-lived, non-revocable bearer credentials are a poor fit for persistent consumer login.

### Use short-lived JWT access tokens and refresh tokens

Pros:

- Limits access-token exposure.
- Fits distributed services that need local JWT validation.

Cons:

- Introduces access-token renewal, refresh-token rotation, token-family reuse detection, and additional failure states.
- Refresh-token persistence effectively recreates server-side session state.
- The current architecture does not need distributed token validation.

Rejected as unnecessary complexity for a first-party web frontend and one backend.

### Use a managed identity provider

Pros:

- Provides mature email delivery, passkeys, social login, MFA, account recovery, and administrative tooling.
- Transfers part of the authentication maintenance burden to a specialized provider.

Cons:

- Adds vendor dependency, pricing exposure, external configuration, and integration behavior.
- The current requirement is deliberately narrow: email OTP plus durable first-party sessions.

Deferred rather than permanently rejected. Reconsider if the product needs passkeys, social identity, MFA, enterprise identity, or sophisticated recovery and session administration.

### Store an authentication token in browser local storage

Pros:

- Straightforward for frontend JavaScript to read and attach to requests.

Cons:

- Any script executing in the application origin can read and export the credential.
- Duplicates transport and persistence work already provided by browser cookies.

Rejected in favor of an `HttpOnly` cookie that JavaScript cannot directly read.

### Use email magic links instead of numeric codes

Pros:

- One-click authentication can reduce typing.
- A high-entropy link token is stronger than a short numeric code against guessing.

Cons:

- Cross-device use and in-app browser behavior can be awkward.
- Link scanners and email security tools can consume or prefetch links.
- The current product direction explicitly chooses an email code flow.

Rejected for the initial implementation, but compatible with the same server-side challenge and session architecture if added later.

## Consequences

- Returning users can remain signed in across browser restarts and different days without repeating OTP authentication while their session is valid.
- Signup and login share one user flow and no longer require password management.
- Every protected request performs a server-side session lookup. This adds a small database cost but provides authoritative expiration and revocation.
- Authentication becomes dependent on transactional email availability when a new login is required.
- OTP security depends on layered controls: secret management, HMAC storage, short expiration, attempt limits, atomic consumption, rate limiting, and safe logging.
- Cookie authentication requires deliberate CORS, origin, CSRF, and cookie-domain configuration.
- Database migrations add authentication challenge, session, and shared rate-limit state and remove password-specific state.
- JWT and password dependencies can be removed after the migration is complete.
- Existing API clients must migrate from bearer-token injection to credentialed cookie requests and from separate signup/login operations to the unified OTP protocol.
- Email OTP remains unsuitable as a claim of multi-factor or high-assurance identity. A future increase in data sensitivity may require passkeys, MFA, or a managed identity platform.

## Explicitly Deferred

- Production transactional-email vendor selection and sending-domain operations.
- Passkeys, social login, SMS, authenticator applications, and multi-factor authentication.
- User-facing device/session management and remote logout.
- Periodic session-token rotation with a concurrent-request grace period.
- Native-mobile credential transport.
- High-assurance or regulated clinical identity requirements.
