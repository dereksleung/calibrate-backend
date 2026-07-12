# ADR-0002: Use email OTP and cookie-backed server sessions

## Status

Accepted

## Date

2026-07-12

## Context

The backend currently creates users with passwords, hashes those passwords with Argon2, authenticates email/password credentials, and issues signed JWT bearer access tokens. Protected routes validate the bearer token and recover the user ID from its subject claim.

Calibrate is a first-party consumer application whose primary authenticated workflow is recording food throughout the day. A common usage pattern is to record dinner, close the application, and return the next morning to record breakfast. Requiring a new login every day would add friction at the moment the product needs to be fastest.

The application does not currently need independent backend services or third-party API consumers to validate access tokens without contacting a shared session store. It does need durable login across browser restarts, server-side revocation, straightforward logout, a unified signup/login experience without password management, and support for both a web frontend and a future native mobile application.

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

After successful OTP verification, create an opaque server-side session. Generate a session token with at least 256 bits of cryptographically secure randomness and store only its digest in PostgreSQL.

Web and native mobile clients use different presentation transports for the same server-side session:

- Web receives the raw token only as a persistent browser cookie. The production cookie uses a `__Host-` name, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute. Web responses never return the token in JSON, and browser code never stores it in local storage or session storage.
- Native mobile receives the raw token in the successful OTP-verification JSON response. The application stores it in iOS Keychain or Android Keystore-backed secure storage and sends it through `Authorization: Bearer <opaque-session-token>` on later requests. The bearer value is opaque and is not a JWT.

Native mobile authentication requests declare `X-App-Platform: ios` or `X-App-Platform: android`. An absent header selects the web transport; unrecognized values are rejected. The selected transport and platform are recorded with the challenge so verification cannot switch credential-delivery modes midway through the flow.

The platform header is not a security boundary. Same-origin browser JavaScript can set it without CORS, an allowed cross-origin browser can set it after preflight, and non-browser clients can spoof it directly. The header selects response and transport behavior only. It never proves application authenticity, grants authorization, exempts rate limits, or independently bypasses origin checks. Mobile app attestation would be required if the server later needs stronger evidence about the calling binary.

Sessions have a 30-day inactivity lifetime and a 180-day absolute lifetime. While a session remains valid, normal use may extend the inactivity expiration and cookie lifetime at most once per day. Renewal never extends the absolute expiration and does not require a refresh token or another OTP.

The first implementation does not rotate the opaque token periodically. It issues a new token after authentication and security-sensitive identity changes. Concurrent-safe periodic rotation may be introduced later if the threat model justifies the added race-handling complexity.

PostgreSQL session state is authoritative. Missing, expired, revoked, or absolutely expired sessions are rejected. Logout revokes the current session and clears the cookie for web sessions. Multiple sessions per user are allowed so separate devices and platforms do not invalidate one another.

Authentication middleware accepts exactly one credential source: the web cookie or the mobile bearer token. Requests carrying both are rejected as ambiguous. Mobile bearer authentication requires a recognized mobile platform header, but possession of a valid opaque token remains the authentication proof.

### HTTP API

Expose these authentication operations under the existing API version:

- `POST /auth/email-otp` creates and delivers an authentication challenge for the web or declared mobile transport.
- `POST /auth/email-otp/verify` verifies a challenge and returns the current user. The web variant sets the session cookie; the mobile variant returns the opaque session token and expiration metadata.
- `GET /auth/session` validates the web cookie or mobile bearer credential and returns the current user.
- `DELETE /auth/session` revokes the current session idempotently and clears the cookie when the request uses web transport.

Web authentication JSON responses do not contain access tokens or refresh tokens. Mobile authentication returns the opaque server-session token required for native secure storage, not a JWT or a separate refresh token. Shared request, header, and response schemas remain owned by the API-contract package.

Protected HTTP routes continue to receive an authenticated user ID through the existing request authentication context. Replacing the middleware credential source must not change day-log ownership checks.

Local development serves the frontend from `http://localhost:3000` and the API from `http://localhost:3001`. Development enables credentialed CORS only for the exact frontend origin.

Production uses one Render web service at `https://calibrate.onrender.com`. Express serves the built frontend and handles API requests under `/api`, so production browser traffic is same-origin and does not require CORS. Staging uses the same shape on a separate Render service or environment, expected to use a service hostname such as `https://calibrate-staging.onrender.com` with its API under `/api`.

Calibrate does not trust wildcard or sibling origins under the shared `onrender.com` hosting domain. Allowlisting always uses complete configured origins, and cookies remain host-only.

Cookie-authenticated state-changing requests validate an exact source origin and reject missing, `null`, or unexpected origins, with `SameSite=Lax` providing an additional CSRF boundary. Native mobile requests are not subject to browser CORS. Valid bearer-authenticated mobile mutations may omit `Origin` because their credential is explicitly attached rather than automatically included by a browser. This distinction is based on the validated credential source, not solely on the platform header.

### Session restoration during backend unavailability

Render free web services may sleep after inactivity, so the first session check made by a returning web or mobile client can fail or time out while the service wakes. Clients distinguish this availability failure from an authentication decision.

The client session state has four meaningful states: checking, authenticated, reconnecting after a transient failure, and unauthenticated after an authoritative response. A minimal persisted hint that the web client previously had a valid session may preserve the authenticated route shell during checking and reconnecting, but it is never accepted as proof by the backend and does not authorize protected data or mutations.

Clients retry `GET /auth/session` for network failures, bounded request timeouts, and `5xx` responses using exponential backoff with jitter. The delay between attempts is capped at 30 seconds, retries share a single in-flight session query, and the overall automatic retry window is five minutes from the initial attempt.

An explicit `401 Unauthorized` is authoritative: the client stops retrying, clears its non-authoritative authenticated hint and user query state, and presents login. Other `4xx` responses keep their own error semantics. Transient failures do not clear the web cookie, mobile bearer token, or server-side session.

During the retry window, a previously authenticated client may continue displaying the authenticated route shell and already-present in-memory state with a reconnecting indication. It does not automatically replay protected mutations, and it does not treat unconfirmed local state as server authorization. A client with no previous authenticated hint displays a neutral checking state rather than assuming authentication.

After five minutes without an authoritative response, automatic retries stop and the client shows a recoverable service-unavailable/session-check-failed state with an explicit retry action. Reaching this deadline does not itself log the user out or delete the credential. A later successful check restores the existing session without another OTP.

The session endpoint remains idempotent from the client's perspective and sends cache controls that prevent shared intermediaries from caching user-specific authentication responses. Successful validation may still perform the existing throttled sliding-expiration renewal.

### Architecture and transaction ownership

Application services coordinate challenge request, challenge verification, user lookup or creation, session creation, session validation, renewal, and revocation through ports.

Presentation owns HTTP validation, status codes, cookie creation and clearing, origin validation, and mapping application results to shared contracts. Infrastructure owns PostgreSQL repositories, Node cryptography, email delivery, shared rate-limit persistence, and secret loading.

Repositories own database transactions in accordance with ADR-0001. Attempt increments, successful challenge consumption, and session renewal use conditional atomic persistence so concurrent requests cannot bypass limits or consume one challenge twice.

The primary behavioral test seam is the HTTP application with an injected fake email sender and controlled persistence. It covers equivalent web-cookie and mobile-bearer authentication journeys. Client tests separately cover transient restoration retries, authoritative `401` handling, route continuity, and the five-minute degraded-state transition. Lower-level tests cover concurrency, expiration, key selection, platform validation, ambiguous credential rejection, and database behavior that cannot be observed reliably through one HTTP journey.

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

### Use the mobile platform header as proof of application identity

Pros:

- Simple way to vary responses between web and native clients.
- Cross-origin browser requests with custom headers usually require CORS preflight.

Cons:

- Same-origin browser JavaScript can set the header without CORS.
- Any script, proxy, or unofficial client can reproduce the header.
- CORS is a browser response policy, not client authentication.

Rejected as an authentication or authorization mechanism. The header remains useful only as untrusted presentation metadata for selecting the credential transport.

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
- Same-origin production and staging deployment avoid browser CORS in those environments; local development retains one exact credentialed CORS origin.
- Native mobile can reuse the revocable server-session model, but its presentation layer must return the raw opaque token and the app must protect it with platform-secure storage.
- The platform header creates no trust by itself. Any future requirement to recognize an official app binary will require app attestation or another independently verifiable mechanism.
- Database migrations add authentication challenge, session, and shared rate-limit state and remove password-specific state.
- JWT and password dependencies can be removed after the migration is complete.
- The web API client must migrate from bearer-token injection to same-origin cookie requests. The native client uses bearer transport for an opaque server-session token. Both migrate from separate signup/login operations to the unified OTP protocol.
- Serving the frontend and API from one Render web service simplifies browser security and deployment, but the selected hosting tier must account for wake-up latency after inactivity.
- Session restoration tolerates a sleeping or temporarily unavailable backend without converting network failure into logout. This improves continuity but can leave the client in a visibly reconnecting state for up to five minutes.
- A persisted authenticated hint is presentation state only. Backend session validation remains the sole authority, and protected mutations cannot rely on the hint.
- Retry backoff reduces wake-up request bursts, but client retries do not remove Render cold-start latency or replace an always-on hosting tier.
- Email OTP remains unsuitable as a claim of multi-factor or high-assurance identity. A future increase in data sensitivity may require passkeys, MFA, or a managed identity platform.

## Explicitly Deferred

- Production transactional-email vendor selection and sending-domain operations.
- Passkeys, social login, SMS, authenticator applications, and multi-factor authentication.
- User-facing device/session management and remote logout.
- Periodic session-token rotation with a concurrent-request grace period.
- Native mobile UI, deep links, and concrete Keychain/Keystore library selection.
- Mobile application attestation and verified official-app identity.
- High-assurance or regulated clinical identity requirements.
