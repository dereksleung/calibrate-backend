# Email OTP Authentication and Cookie Sessions

Status for Matt Pocock skills: ready-for-agent

## Problem Statement

People use Calibrate at moments when speed matters, such as recording breakfast before starting the day. The current account flow requires a password and returns a JWT bearer token, but it does not provide a complete, durable browser-session experience. A returning user should not need to authenticate every day, manage a token in browser storage, or wait through unnecessary login steps before recording food.

Calibrate needs one authentication flow that supports both signup and login, proves control of an email address without passwords, and keeps a user signed in across browser restarts and different days. The backend must still be able to revoke sessions, expire abandoned sessions, protect OTP codes from replay and brute-force attacks, and identify the user on every protected request.

## Solution

Replace password signup and JWT login with a unified email one-time password flow. A person enters an email address, receives a short-lived numeric code, and submits that code with the challenge identifier returned by the backend. Successful verification creates the user when the email is new or signs in the existing user when the email is already registered.

After verification, the backend creates an opaque server-side session and sends its random token in a persistent `HttpOnly` cookie. The browser automatically sends the cookie on later requests. A returning user can reopen Calibrate the next day, have the frontend check the session, and continue directly to food logging while the session remains valid.

The session uses a 30-day inactivity lifetime and a 180-day absolute lifetime. Normal activity renews the inactivity lifetime at most once per day. A user returns to email OTP only when the session is absent, expired, revoked, or has reached its absolute lifetime.

## User Stories

1. As a new user, I want to create an account using only my email address, so that I do not need to choose or remember a password.
2. As an existing user, I want to use the same email OTP screen to sign in, so that I do not need to decide whether I am signing up or logging in.
3. As a user, I want the application to send a code to the email address I entered, so that I can prove I control that address.
4. As a user, I want a clear indication that a code was requested, so that I know to check my inbox.
5. As a user, I want the code to arrive quickly, so that authentication does not interrupt food logging.
6. As a user, I want to request another code after a short cooldown, so that delayed or lost email does not permanently block me.
7. As a user, I want a newly requested code to replace older codes, so that it is clear which code is valid.
8. As a user, I want an invalid or expired code to produce a clear but non-sensitive error, so that I can recover without exposing account information.
9. As a user, I want successful OTP verification to sign me in immediately, so that I can continue into the application without another step.
10. As a returning user, I want to reopen the application the next day and remain signed in, so that I can record breakfast while in a rush.
11. As a returning user, I want the application to restore my identity automatically, so that I do not see the login screen during a valid session.
12. As an active user, I want normal use to extend my inactivity expiration, so that regular food logging does not repeatedly force reauthentication.
13. As an inactive user, I want the application to require a new OTP after a long absence, so that an abandoned browser session does not remain valid forever.
14. As a user, I want sessions to have a maximum lifetime even when I remain active, so that long-lived credentials are periodically replaced through reauthentication.
15. As a user, I want to sign out of the current browser, so that its session can no longer access my data.
16. As a user, I want logout to succeed even if my session has already expired, so that the application always returns to a clean signed-out state.
17. As a user, I want to use Calibrate on more than one device, so that signing in on my phone does not unexpectedly end my desktop session.
18. As a user, I want my existing account and food history preserved when password authentication is removed, so that changing the login method does not lose my data.
19. As a user, I want an existing email account to become email-verified after successful OTP authentication, so that account state reflects what I proved.
20. As a user, I want failed OTP guesses to be limited, so that another person cannot efficiently guess my code.
21. As a user, I want OTP codes to expire quickly and work only once, so that an intercepted or previously used code has little value.
22. As a user, I want authentication secrets excluded from logs and API responses, so that operational tooling does not leak access to my account.
23. As a user, I want requests for OTP emails to be rate-limited, so that an attacker cannot flood my inbox.
24. As a user, I want authentication responses not to reveal whether my email already has an account, so that account membership remains private.
25. As a user, I want my session cookie protected from frontend JavaScript, so that common script injection failures cannot directly read and export it.
26. As a user, I want protected food-log requests to continue using my authenticated user identity, so that I can access only my own nutrition data.
27. As a developer, I want signup and login request and response shapes defined in shared API contracts, so that backend and clients agree on the protocol.
28. As a developer, I want authentication rules coordinated in the application layer, so that HTTP, database, cryptography, and email details remain replaceable adapters.
29. As a developer, I want OTP delivery behind an email-sender interface, so that tests do not send real email and the production provider can be selected independently.
30. As a developer, I want session state stored on the server, so that logout, expiration, and administrative revocation can take effect without maintaining a JWT denylist.
31. As an operator, I want HMAC keys versioned and stored outside the database, so that keys can be rotated without accepting unverifiable challenges.
32. As an operator, I want authentication lifecycle events recorded without raw secrets, so that abuse and failures can be investigated safely.
33. As an operator, I want expired challenges, sessions, and rate-limit records to be removable through retention maintenance, so that authentication tables do not grow indefinitely.
34. As a web user, I want the browser to receive my session only as an `HttpOnly` cookie, so that frontend JavaScript cannot directly export it.
35. As a native mobile user, I want the application to receive an opaque session credential it can store in platform-secure storage, so that I can remain signed in without depending on browser cookies.
36. As a native mobile user, I want my authenticated requests to use the same revocable server sessions as the web application, so that session behavior remains consistent across platforms.
37. As a developer, I want mobile requests to declare their platform through a consistent header, so that the presentation layer can select the appropriate credential transport.
38. As a security reviewer, I want platform headers treated as untrusted metadata rather than proof of client identity, so that spoofing the header cannot grant permissions or bypass authentication.
39. As an operator, I want production and staging web traffic to remain same-origin, so that browser cookie behavior and CSRF protections stay simple.

## Implementation Decisions

- Email OTP is the only end-user signup and login method in the completed flow. Password-based account creation and password login will no longer be exposed by the backend.
- Signup and login are intentionally unified. A verified email challenge creates a user when no user exists for the normalized email and signs in the existing user otherwise.
- Email addresses are trimmed and normalized consistently before challenge creation and user lookup. The database continues to enforce one user per normalized email.
- Existing users and their nutrition data are retained. The password-hash column and password-specific domain behavior are removed; an existing user verifies the email through OTP on the next login.
- A request to create an email OTP challenge accepts an email address and returns `202 Accepted` with a public challenge identifier, challenge expiration metadata, and resend timing metadata. It never returns the OTP.
- OTP delivery is handled through an application port. Tests use a fake sender that captures the code, while production uses a transactional-email infrastructure adapter. Vendor selection is independent of the application contract.
- A challenge contains a random public identifier, normalized email, purpose, HMAC digest, HMAC format version, HMAC key version, attempt count, maximum attempts, expiration time, consumption time, invalidation time, and creation time. Abuse-control metadata may include a protected representation of the requesting IP address.
- OTP codes are six numeric digits generated with a cryptographically secure random-number generator. A challenge expires after 10 minutes and permits at most five verification attempts.
- Resending is allowed after a 60-second cooldown. A resend creates a new challenge and invalidates earlier unconsumed authentication challenges for the same normalized email.
- The backend never stores an OTP in plaintext. It stores an HMAC-SHA-256 digest over a structured message containing the authentication namespace, HMAC format version, challenge purpose, challenge identifier, and code.
- The HMAC format version describes how the authenticated message is constructed. The HMAC key version identifies which server key generated the digest. Both are stored with the challenge.
- Each environment uses its own independently generated 32-byte OTP HMAC key. The key is stored outside the application database and source repository, is shared by backend replicas within the same environment, and is not reused for session tokens or unrelated cryptographic purposes.
- Verification recomputes the HMAC digest and uses a timing-safe comparison. Unknown, expired, invalidated, consumed, exhausted, and incorrect challenges produce a generic invalid-or-expired-code response.
- Failed verification atomically increments the challenge attempt count. Successful verification atomically consumes the challenge so that concurrent requests cannot both use it.
- User creation occurs only after successful OTP verification. Concurrent successful challenges for the same email rely on the unique normalized-email constraint and concurrency-safe persistence to resolve to one user.
- Successful verification creates an opaque server session. The raw session token contains at least 256 bits of cryptographically secure randomness; only its digest is persisted.
- Web and native mobile clients use the same opaque server-session model but different presentation transports. The web client receives the raw session token only in a persistent cookie. A native mobile client receives the raw token in the successful OTP-verification JSON response and stores it in iOS Keychain or Android Keystore-backed secure storage, never ordinary application storage such as AsyncStorage.
- Native mobile clients send `X-App-Platform: ios` or `X-App-Platform: android` on authentication requests. Header names are case-insensitive, but these lowercase values are the canonical contract values. An absent header selects the web flow, and an unknown value fails request validation.
- The challenge records the selected session transport and mobile platform when it is created. Verification must use the same transport classification, preventing a challenge from silently switching from cookie delivery to JSON token delivery midway through the flow.
- `X-App-Platform` is an untrusted transport-selection hint, not proof that a request came from an official mobile binary. Same-origin browser JavaScript, scripts, and malicious clients can set or spoof custom headers. No authentication, authorization, rate-limit exemption, or origin-check bypass is granted solely because this header is present.
- Web OTP verification returns the current user and sets the session cookie without returning a token in JSON. Mobile OTP verification returns the current user, opaque session token, and session expiration metadata without setting a browser session cookie. Shared API contracts define these response variants explicitly.
- Native mobile authenticated requests send the opaque token through `Authorization: Bearer <opaque-session-token>` together with the platform header. `Bearer` describes credential transport and does not imply that the token is a JWT.
- The authentication middleware accepts exactly one credential source per request: the web session cookie or the mobile bearer token. Requests containing both are rejected as ambiguous. A mobile bearer credential requires a recognized mobile platform header, but the session token remains the actual credential.
- The production cookie uses a `__Host-` name with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`, and has no `Domain` attribute. Local development may use an environment-specific cookie name and transport configuration when HTTPS is unavailable.
- A session records its user, token digest, creation time, last-seen time, inactivity expiration, absolute expiration, revocation time, and renewal time. User-agent and protected IP metadata may be retained for security operations.
- Sessions have a 30-day inactivity lifetime and a 180-day absolute lifetime. A valid request may extend inactivity expiration and reset cookie expiration at most once per day, but it never extends the absolute expiration.
- Session renewal does not require a refresh token or another OTP. It updates the server-side expiration and persistent cookie while the current session remains valid.
- Periodic session-token rotation is not required in the first implementation. Tokens are replaced after authentication and security-sensitive identity changes; adding concurrent-safe periodic rotation is a later hardening option.
- `GET /api/v1/auth/session` authenticates either the web cookie or mobile bearer credential and returns the current user when valid. It returns `401 Unauthorized` when the required credential is missing or the session is invalid.
- `DELETE /api/v1/auth/session` revokes the current session idempotently and returns `204 No Content`. For web requests it also clears the cookie with matching attributes.
- `POST /api/v1/auth/email-otp` requests a challenge for the selected web or mobile transport. `POST /api/v1/auth/email-otp/verify` verifies the challenge and returns the transport-specific authentication response.
- Completed migration removes `POST /api/v1/auth/login`, password-based `POST /api/v1/users`, bearer-token authentication, access-token fields in login responses, JWT infrastructure, and password hashing infrastructure.
- New request and response schemas live in the shared API-contract package. Legacy password contract exports may remain temporarily deprecated only to keep the existing frontend compiling until its migration; they are removed at the frontend/backend wiring gate.
- Protected controllers continue receiving the authenticated user ID through the existing request authentication context. Day-log authorization behavior does not change when the middleware switches from bearer tokens to cookie sessions.
- Application services coordinate OTP request, OTP verification, user lookup or creation, session creation, session validation, renewal, and revocation through ports. Presentation owns HTTP validation and cookie attributes. Infrastructure owns PostgreSQL, cryptography, email delivery, and transaction implementation.
- Persistence repositories own transaction boundaries in accordance with the backend clean-architecture ADR. Conditional challenge consumption and session renewal must be atomic at the repository boundary.
- OTP request controls consume limits by normalized email and requesting IP, include a resend cooldown, and support a global delivery ceiling. Verification controls include both per-challenge attempts and broader abuse monitoring.
- Rate limits must work across multiple backend instances. They may use PostgreSQL-backed counters or another shared infrastructure store; process-memory-only limits are insufficient for production.
- Authentication endpoints use generic outward responses and avoid response-shape differences that disclose whether a user exists. Internal telemetry may distinguish outcomes without recording the OTP, raw session token, or HMAC key.
- Local web development uses `http://localhost:3000` for the frontend and `http://localhost:3001` for the API. The API allows credentialed CORS only from the exact frontend origin. Development should use `localhost` consistently rather than mixing it with `127.0.0.1`.
- Production uses one Render web service at `https://calibrate.onrender.com`. Express serves the built frontend and handles the API under `https://calibrate.onrender.com/api`, making browser requests same-origin and eliminating production CORS requirements.
- Staging uses a separate Render web service or environment with the same-origin shape, expected to be `https://calibrate-staging.onrender.com` with its API under `/api`. The exact Render-assigned hostname is confirmed during provisioning rather than assuming a nested `staging.calibrate.onrender.com` hostname.
- No wildcard under `onrender.com` is trusted. Render is a shared hosting domain, and Calibrate controls only its assigned service hostnames. Production cookies remain host-only through the `__Host-` prefix and no `Domain` attribute.
- Cookie-authenticated state-changing requests require an exact `Origin` match for the configured environment and reject missing, `null`, or unexpected origins. `SameSite=Lax` is an additional CSRF defense, and no safe HTTP method performs state changes.
- Native mobile networking is not governed by browser CORS and commonly omits `Origin`. A request authenticated by a valid mobile bearer session does not require browser-origin validation because the credential is explicitly attached rather than automatically sent as a cookie. This exception is based on credential transport, not merely on `X-App-Platform`.
- Expired and revoked records are rejected based on server time. Retention maintenance removes old challenges, sessions, and rate-limit buckets after their security and audit value has elapsed.
- Email OTP proves control of an email inbox but is not treated as multi-factor or high-assurance authentication.

## Testing Decisions

- Tests assert externally observable authentication behavior rather than private method calls, SQL construction, cryptographic call counts, or other implementation details.
- The primary test seam is an HTTP-level authentication journey through the Express application with an injected fake email sender and persistence adapter. It requests an OTP, obtains the delivered code from the fake, verifies the challenge, captures the cookie, accesses a protected resource, restores the session, logs out, and confirms later access is unauthorized.
- The HTTP journey verifies both new-user signup and existing-user login without asserting which internal branch created or loaded the user.
- Shared API-contract tests validate accepted and rejected request bodies and the response schemas for challenge creation, verification, and session restoration.
- Application-service tests cover expiration decisions, resend invalidation, user creation versus lookup, renewal timing, absolute expiration, and generic error behavior with a deterministic clock and test doubles.
- Persistence integration tests cover atomic attempt increments, single-use consumption, concurrent verification, unique-email races, token-digest lookup, session renewal, expiration, and revocation against PostgreSQL.
- Cryptography adapter tests verify deterministic HMAC output for the same version, key, challenge, purpose, and code; digest changes when any bound value changes; key-version selection works; and malformed key configuration fails closed. Tests never assert or snapshot production secrets.
- Presentation tests verify cookie attributes, status codes, response bodies, origin rejection, missing-cookie behavior, and preservation of the authenticated user context expected by protected controllers.
- Presentation tests cover both transport variants: absent platform header produces the web cookie response, recognized mobile platform headers produce the mobile token response, unknown values are rejected, and a cookie plus bearer token is rejected as ambiguous.
- Security tests demonstrate that the platform header alone never authenticates a request and never bypasses authorization or cookie-origin checks.
- Local CORS tests allow credentialed requests only from `http://localhost:3000`. Production and staging configuration tests confirm that same-origin browser traffic does not enable broad CORS or wildcard `onrender.com` origins.
- Mobile session tests verify bearer-token authentication without an `Origin` header, server-side expiration and revocation, logout, and the same authenticated-user context used by web sessions.
- Rate-limit tests verify resend cooldown, per-email limits, per-IP limits, attempt exhaustion, and generic `429` behavior without depending on a specific backing-store algorithm.
- Existing auth-service, auth-controller, and auth-middleware tests provide prior art for service, presentation, and request-authentication seams. Existing repository patterns provide prior art for PostgreSQL integration boundaries.
- A clock seam is justified because expiry and renewal behavior must be deterministic. An email-sender seam is justified because the highest-level test must observe delivery without contacting a real provider.
- Security-sensitive logs are tested to ensure they omit OTP codes, raw session tokens, HMAC keys, and complete cookie values.

## Out of Scope

- Frontend screens, routing, form behavior, TanStack Query integration, and cookie-enabled transport configuration are outside this backend specification, except where shared API contracts define the protocol they must consume.
- Selecting and provisioning the production transactional-email vendor, sending domain, SPF, DKIM, DMARC, bounce handling, and complaint handling are separate infrastructure and operational work.
- Social login, passwords, password reset, SMS OTP, authenticator-app OTP, passkeys, and multi-factor authentication are not included.
- Organization accounts, roles, impersonation, delegated access, and third-party OAuth authorization are not included.
- A user-facing device/session management screen and remote logout of other devices are deferred, although the server-side model should permit later implementation.
- Periodic session-token rotation with a concurrent-request grace window is deferred.
- Native mobile UI, deep-link behavior, and platform-specific secure-storage implementation details are outside this backend specification. The backend mobile credential transport and its API contracts are in scope.
- Mobile application attestation, such as Apple App Attest or Google Play Integrity, is deferred. Until attestation is introduced, the platform header must remain untrusted metadata.
- High-assurance identity verification and regulated clinical-authentication requirements are not claimed by this email-based flow.

## Further Notes

- The feature prioritizes low-friction daily use: a valid persistent session should make reopening the application feel like returning to the food log, not performing another login.
- A session check is authentication with an existing credential, not a replay of the email OTP login flow.
- HMAC protects OTP digests when the database is compromised without the application key. It does not replace expiration, attempt limits, atomic consumption, delivery throttling, or secure key management.
- Hashing the high-entropy session token is sufficient because the token is not human-memorable and cannot feasibly be enumerated. The low-entropy numeric OTP needs a keyed digest because its possible values are enumerable.
- If an OTP HMAC key is compromised, rotate the key and invalidate outstanding challenges for that key version. Independently protected sessions do not need to be revoked solely because the OTP key changed.
- The ADR for this feature supersedes only the password/JWT technology examples in the existing backend architecture ADR. Clean architecture boundaries and dependency direction remain in force.
- Render free web services may sleep when inactive, which can delay the first request when a user returns. Hosting-tier selection should account for the product requirement that opening the breakfast log feels immediate.
