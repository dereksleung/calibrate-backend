# ADR-0002: Use passkeys, short access sessions, and sender-constrained refresh rotation

## Status

Accepted

## Date

2026-07-12

## Last Updated

2026-07-26

## Context

The backend currently has authentication code for passwords, email OTP, and bearer-style sessions at different stages of migration. The intended end state needs one coherent lifecycle rather than another compatibility layer.

Calibrate is a first-party consumer application whose primary authenticated workflow is recording food throughout the day. A user should not have to repeat full authentication every morning, but a credential that authorizes ordinary API calls should not remain valid for weeks or months.

The security model therefore separates three concerns:

1. A passkey proves the user is present and has unlocked an authenticator. It is used for signup, login, re-authentication, and security-sensitive credential management.
2. A short opaque access session authorizes ordinary API calls and limits the useful lifetime of a stolen browser cookie.
3. A remembered-device family preserves convenient sign-in across access-session expiration. Its one-time refresh token is sender-constrained to a separate device proof-of-possession key and rotated whenever it is used.

Email remains mandatory as an account-recovery channel. Email is not the normal login factor. Because control of the recovery inbox can ultimately regain the account, email remains the assurance ceiling of the overall recovery design and must not be represented as multi-factor or high-assurance identity proof.

The application does not need independently verifiable JWT access tokens. PostgreSQL can remain authoritative for access sessions, refresh-token families, revocation, and replay detection.

ADR-0001 lists Argon2 and jose JWTs as examples of infrastructure technologies. This ADR supersedes those authentication-specific examples and the earlier email-OTP-primary decision in this file. It does not supersede ADR-0001's clean architecture, domain boundaries, dependency direction, or transaction ownership decisions.

## Decision

### Trust and lifetime model

Use the following distinct credentials and clocks:

| Credential or state | Purpose | Inactivity lifetime | Absolute lifetime | Rotation or renewal |
| --- | --- | --- | --- | --- |
| WebAuthn passkey | User authentication and re-authentication | Not applicable | Until removed or revoked | Add or remove through an authenticated credential-management ceremony |
| Access session | Authorize ordinary API requests | 30 minutes | 8 hours | Replaced by a successful refresh; activity may slide inactivity only up to the fixed absolute expiry |
| Remembered-device family | Permit silent creation of new access sessions | 7 days | 30 days | Refresh use slides inactivity, capped by the fixed absolute expiry |
| Refresh token | One-time secret within a remembered-device family | Inherits the family limit | Inherits the family limit | Rotated after every successful use |
| DPoP key | Prove possession of the device key bound to a family | Inherits the family limit | Inherits the family limit | A new key is bound when a new family is created |

The access-session limits and remembered-device limits serve different purposes. The 30-minute inactivity and 8-hour absolute access-session limits follow the short web-session model described by OWASP. The 7-day inactivity and 30-day absolute limits apply only to silent renewal. They do not make one access credential valid for seven or 30 days.

The 30-day remembered-device absolute limit is a re-authentication boundary. It is never extended by refresh-token use. A successful passkey re-authentication creates a new family and resets that boundary.

### Passkey-based signup

Use WebAuthn passkeys as the primary credential. Signup requires both a verified recovery email and creation of an initial passkey:

1. The user supplies a normalized email address.
2. The backend sends and verifies a short-lived email code for the `signup-email-verification` purpose.
3. Successful verification issues a short-lived, single-use enrollment authorization. It does not create an access session.
4. The client requests WebAuthn registration options under that authorization and calls `navigator.credentials.create()`.
5. The backend verifies the registration response and atomically creates the user, records the verified recovery email, binds the first passkey, consumes the enrollment authorization, and creates the first remembered-device family and access session.

User creation does not occur until both email control and passkey registration have been proven. A random, opaque WebAuthn user handle is created with the enrollment and retained as the account's stable WebAuthn handle; the email address is not used as that handle. Enrollment authorizations are stored server-side or represented by an opaque high-entropy token whose digest is stored server-side. They are narrowly scoped to completing one signup and cannot call ordinary protected APIs.

Request discoverable credentials so login can be usernameless:

- `residentKey: "required"`
- `userVerification: "required"`
- no authenticator attachment restriction
- attestation conveyance `none` for the initial implementation

The policy allows both synced passkeys and device-bound passkeys. Calibrate does not require hardware attestation or restrict users to a particular authenticator vendor.

### Passkey login and re-authentication

Login and re-authentication use a WebAuthn authentication ceremony with `userVerification: "required"`. The server creates a random, single-use, short-lived, purpose-bound challenge and verifies:

- the ceremony type and challenge;
- the exact configured origin;
- the relying-party ID hash;
- the credential ID and stored public key;
- the assertion signature and allowed algorithm;
- the user-presence and user-verification flags; and
- the challenge's expiration, purpose, and unused state.

The challenge is consumed atomically. Authentication responses are never accepted solely because a client reports that biometrics, a PIN, or another local check succeeded.

Each user may register multiple passkeys. A passkey credential record contains at least the user ID, globally unique credential ID, public key and algorithm, transports, signature counter, backup-eligibility and backup-state flags, creation time, last-used time, and revocation state.

Signature counters are recorded and evaluated as a risk signal. Synced passkeys may expose zero or non-monotonic counters, so a counter anomaly is not an unconditional authentication failure without considering authenticator capabilities and other signals.

After a successful passkey registration or login, the client supplies a newly generated DPoP public key as part of the authorized completion request. The backend computes its thumbprint, creates a remembered-device family bound to that key, then issues its initial refresh token and access session.

Passkey addition requires a recent successful passkey authentication or a narrowly scoped recovery authorization. Passkey removal requires recent passkey authentication. Users are notified through their verified email when a passkey is added or removed.

### Mandatory email recovery

Email OTP is used only to verify the recovery address during signup and to recover an account when no registered passkey is usable. It is not offered as a routine login shortcut.

Recovery follows this lifecycle:

1. The user requests recovery for an email address. The response is generic whether or not an account exists.
2. The backend sends a code for the `account-recovery` purpose.
3. Successful verification issues a short-lived, single-use recovery authorization. It does not create an ordinary access session.
4. The recovery authorization may only start and complete registration of a new passkey for that account.
5. Successful new-passkey registration revokes all access sessions and remembered-device families for the account, creates a new family bound to a fresh DPoP key, creates a new access session, and sends a security notification.

Recovery does not automatically delete the user's other passkeys. This initially preserves an independent authentication route for the legitimate user and retains an audit trail. Passkeys can later be reviewed and explicitly revoked through the normal credential-management flow.

Every account must retain one verified recovery email. Changing it requires recent passkey authentication plus verification of the new address; the previous and new addresses receive security notifications. The recovery address cannot be removed without atomically replacing it with another verified address.

Email challenges use six cryptographically random numeric digits, expire after 10 minutes, allow at most five attempts, and are single use. A resend is subject to a 60-second cooldown and invalidates older unconsumed challenges for the same email and purpose.

The database stores an HMAC-SHA-256 digest, never the plaintext code. The structured HMAC input binds a namespace, format version, purpose, challenge identifier, and code. The independent 32-byte HMAC key is stored outside the database and repository; key and format versions are persisted for controlled rotation. HMAC protects against a database-only disclosure but does not replace expiration, atomic consumption, attempt limits, and rate limits.

### Short opaque access sessions

After signup, login, recovery, re-authentication, or refresh, generate an opaque access-session token with at least 256 bits of cryptographically secure randomness. Store only a digest in PostgreSQL.

An access session has:

- a 30-minute sliding inactivity expiry;
- an 8-hour fixed absolute expiry, capped by the remembered-device family's absolute expiry;
- a user ID and remembered-device-family ID;
- creation, last-used, revocation, and replacement metadata; and
- optional risk and client metadata that contains no raw credential.

PostgreSQL is authoritative. Missing, expired, revoked, or replaced sessions are rejected. A session is also rejected when its remembered-device family is revoked or expired. Activity may update the inactivity expiry with throttled writes, but never beyond the access session's or family's absolute expiry.

For the web, the token is returned only in a host-only `__Host-` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no `Domain` attribute. An HTTP localhost environment that cannot set `Secure` uses a distinct unprefixed development cookie name; it must not weaken the production cookie definition. The token is never returned in web JSON or stored in local storage or session storage.

General authentication middleware validates only the access credential and provides the existing authenticated-user context to protected routes. Day-log ownership checks do not change.

### Remembered-device families and refresh-token rotation

Each successful signup, login, recovery, or 30-day re-authentication creates a new remembered-device family for that browser or app installation.

A family stores at least:

- user ID and family ID;
- the DPoP public-key thumbprint and accepted algorithm;
- creation, last-used, inactivity-expiry, and absolute-expiry timestamps;
- current refresh-token generation;
- revocation time and reason; and
- authentication-method and risk metadata suitable for auditing.

The family inactivity expiry is updated after successful refresh as:

`min(now + 7 days, family.absoluteExpiry)`

The absolute expiry is fixed at family creation time as `createdAt + 30 days`.

Refresh tokens are opaque, one-time secrets with at least 256 bits of cryptographically secure randomness. Store only token digests. Each refresh-token record identifies its family, generation, parent or replacement relationship, creation and expiry, and consumption or revocation state. Retain consumed-token digests long enough to detect reuse.

For the web, the refresh token is returned only in a separate host-only cookie:

- `__Secure-` name because a narrowly scoped cookie cannot satisfy the `__Host-` requirement that `Path=/`;
- `HttpOnly`;
- `Secure`;
- `SameSite=Strict`;
- no `Domain`; and
- `Path=/api/v1/auth/session`.

The narrow authentication-session path prevents the browser from sending the refresh credential on ordinary API requests while allowing refresh and logout to receive it. `GET /auth/session` ignores it and validates only the access session. Cookie `Path` is delivery scoping, not a security boundary; refresh and logout still validate the exact `Origin`, DPoP proof, token state, and family state.

The refresh cookie's expiry is capped by the family's inactivity and absolute expiries. An HTTP localhost environment uses a distinct unprefixed development cookie name if it cannot set `Secure`.

The refresh endpoint is a `POST` endpoint outside the ordinary access-session middleware. It intentionally accepts the refresh cookie even when the broader access cookie is also present. Endpoints outside the authentication-session path do not receive the refresh cookie.

On successful refresh, one repository transaction:

1. verifies that the family is active and inside both expiry limits;
2. verifies the current refresh token and its generation;
3. verifies a fresh DPoP proof from the key bound to the family;
4. marks the presented refresh token consumed;
5. creates the next refresh-token generation;
6. updates the family inactivity expiry, capped by its absolute expiry;
7. revokes or replaces the previous access session; and
8. creates a new short access session.

Only after the transaction commits does the response set the new refresh and access cookies and provide the next DPoP nonce. Refresh, authentication, and session responses use `Cache-Control: no-store`.

Refresh occurs when the access session needs renewal. Daily use is the expected product pattern, but correctness does not depend on a once-per-day timer: a user may refresh more than once in a day, and a user with a still-valid access session does not rotate merely because a calendar day changed.

### DPoP device proof

Use the proof format and sender-constraining semantics defined by RFC 9449 for refresh requests. Calibrate is not acting as a general OAuth authorization server, so this is a first-party DPoP profile rather than a claim of complete OAuth token-endpoint conformance.

After passkey registration or authentication, the web client creates a separate asymmetric key pair. Its private key must be non-extractable and persisted by the browser where supported. The client sends the public JWK in the authorized completion request; the backend validates it and computes the thumbprint stored on the family. A future native client stores this key in Keychain/Keystore-backed hardware when available.

When a successful signup, login, recovery, or re-authentication completion creates a remembered-device family, the response proactively provides that family's initial opaque nonce in a `DPoP-Nonce` header after the transaction commits. The client persists the most recently received nonce with its DPoP-key state, scoped to the API origin, and coordinates nonce updates with its cross-tab refresh coordinator. The nonce is not a credential or secret; it is unpredictable server-provided freshness input for the next proof. A cross-origin deployment exposes the header to browser JavaScript with `Access-Control-Expose-Headers: DPoP-Nonce`.

The DPoP key is not the passkey key:

- the passkey private key is controlled by the authenticator and signs WebAuthn ceremony data only after user verification;
- the DPoP private key is available to the application for silent refresh proofs; and
- creating or possessing a DPoP key alone never authenticates a user or resets a family lifetime.

Each refresh request includes a signed DPoP JWT containing the public JWK, the required `jti`, `htm`, `htu`, and `iat` claims, and the most recently received server nonce. The server verifies:

- the `typ` header is `dpop+jwt`, the JWK is public, and `alg` is an allowed asymmetric algorithm rather than `none` or a symmetric algorithm;
- the signature and allowed asymmetric algorithm;
- `htm` equals `POST`;
- `htu` equals the normalized refresh endpoint URL;
- `iat` is inside a short freshness window;
- `jti` has not already been accepted inside the proof-retention window;
- a server-provided nonce is current; and
- the signing key thumbprint equals the key bound to the family.

After a successful refresh commits, the response proactively supplies the nonce for the next proof in a new `DPoP-Nonce` header. The client replaces its stored nonce with that value. The server may retain a tightly bounded window of recently issued nonces to tolerate in-flight requests, but proof-ID replay and issue-time checks continue to apply.

If the client has no nonce because local state was lost or no family-creation response was observed, it sends a fresh signed proof without a `nonce` claim. If a proof omits the nonce or presents a stale nonce, the server returns `400` with the `use_dpop_nonce` error and a fresh `DPoP-Nonce` header. This challenge is a safe pre-consumption response: it does not accept the proof's `jti`, consume or rotate the refresh token, extend the family lifetime, or replace the access session.

After a nonce challenge, the client stores the supplied nonce, creates an entirely new signed proof with a new `jti` and `iat`, and retries through the single-flight refresh coordinator. It never reuses the challenged JWT. This challenge path is also the fallback when a successful refresh committed but the client did not observe the proactively supplied next nonce.

When logout relies on the refresh credential because no access session is valid, it uses the same proof rules with `htm` and `htu` bound to the logout request.

Sender constraining means a copied refresh-token cookie is insufficient off-device without the DPoP private key. It does not prevent active same-origin malicious JavaScript from asking the browser-held key to sign while that script is executing. Content Security Policy, dependency hygiene, output encoding, and other XSS controls remain required.

If the DPoP key is lost but the refresh cookie remains, the refresh token cannot be rebound or used alone. The user performs passkey authentication to create a new family, or uses email recovery if no passkey is available.

### Refresh-token reuse and concurrency

Presenting a consumed refresh token with a fresh, otherwise valid DPoP proof from the family-bound key is reuse. The family relationship allows the backend to identify the current descendant token even though only digests are stored.

Reuse outside a tightly bounded concurrent-request window revokes the entire family, including its current refresh token and access sessions. The response clears web cookies and requires passkey authentication. The backend cannot reliably determine whether the older token was replayed by an attacker or retried by the legitimate client, so it fails closed.

DPoP verification occurs before reuse can trigger revocation. A request with a missing, invalid, wrong-key, or already-used DPoP proof is rejected without revoking the family, preventing possession of a copied refresh cookie alone from becoming a family-revocation primitive.

Within a short configured concurrency window, a second request that presents the just-consumed token and a valid proof from the family's DPoP key returns a retryable `409 REFRESH_ALREADY_ROTATED`. It does not issue credentials, extend either lifetime, or revoke the family. This limits false family revocation from near-simultaneous browser tabs without returning a successor token twice.

The web client uses a single-flight refresh coordinator across tabs, such as Web Locks plus `BroadcastChannel`, and retries only after observing the browser's updated cookie state. The repository uses row locking or equivalent conditional atomic writes so only one request can consume a generation. Lost responses outside the concurrency accommodation may require passkey re-authentication; this is accepted in preference to storing recoverable plaintext successor tokens.

### Thirty-day passkey re-authentication

At the remembered-device family's absolute expiry, the refresh endpoint returns `REAUTHENTICATION_REQUIRED` and does not rotate or extend the family.

The client performs an explicit WebAuthn assertion with `userVerification: "required"`. After success, the client creates a fresh DPoP key and the backend:

1. revokes the old family and any remaining access sessions under it;
2. creates a new family with new 7-day inactivity and 30-day absolute clocks;
3. binds the new family to the fresh DPoP public key;
4. issues the first refresh token for the new family; and
5. creates a new short access session.

The old family's absolute timestamp is never rewritten. Creating a new family preserves an auditable security boundary and retires the old refresh-token lineage.

This ceremony requires explicit user interaction with the passkey authenticator; it is not a background refresh. If no passkey is usable, the user follows the email recovery flow.

### HTTP API

Expose these operations under the existing `/api/v1` prefix:

- `POST /auth/email-verification` requests the signup recovery-email code.
- `POST /auth/email-verification/verify` verifies that code and creates a limited enrollment authorization.
- `POST /auth/passkeys/registration/options` creates passkey-registration options for an enrollment, recovery, or recently authenticated credential-management authorization.
- `POST /auth/passkeys/registration/verify` verifies registration and completes the authorized operation.
- `POST /auth/passkeys/authentication/options` creates usernameless passkey-authentication options.
- `POST /auth/passkeys/authentication/verify` verifies an assertion and completes login or re-authentication.
- `POST /auth/recovery/email` requests an account-recovery email code.
- `POST /auth/recovery/email/verify` verifies that code and creates a limited recovery authorization.
- `POST /auth/recovery-email/change` requests verification of a replacement recovery address after recent passkey authentication.
- `POST /auth/recovery-email/change/verify` verifies and atomically installs the replacement recovery address.
- `POST /auth/session/refresh` verifies the refresh cookie and DPoP proof, rotates the refresh token, and creates a new access session.
- `GET /auth/session` validates only the access session and returns the current user.
- `DELETE /auth/session` revokes the current family and its access sessions idempotently, then clears both cookies.

Shared request, response, and error schemas remain owned by the API-contract package. Web JSON never contains access or refresh tokens.

Responses that create a remembered-device family and successful refresh responses provide the next `DPoP-Nonce` header. A refresh nonce challenge returns `400 use_dpop_nonce` with a replacement `DPoP-Nonce` header and no credential-state mutation.

`DELETE /auth/session` is full logout for the current remembered device. A valid access session identifies the family. If only the refresh credential remains, the endpoint requires a valid DPoP proof before revoking that family. With no valid credential, it still clears both cookies idempotently without changing server state. Cookie clearing uses the same names, paths, and security attributes used when each cookie was set. A future session-management endpoint may support revoking selected or all other families.

### Session restoration and client states

`GET /auth/session` remains the ordinary startup check:

- `200` returns the authenticated user.
- `401 ACCESS_SESSION_REQUIRED` means the access session is missing or unusable and the client may attempt one coordinated refresh.
- a successful refresh is followed by `GET /auth/session` or returns the same current-user representation by contract;
- `REAUTHENTICATION_REQUIRED` presents the passkey ceremony;
- invalid, revoked, or replayed family state presents passkey login; and
- network failures, bounded timeouts, and `5xx` responses are availability failures, not logout decisions.

The client states are checking, authenticated, refreshing, re-authenticating, reconnecting, unauthenticated, and recoverably unavailable. A persisted hint that the client was authenticated may preserve the route shell while checking or reconnecting, but it is never backend proof and cannot authorize protected data or mutations.

For a sleeping backend, clients retry idempotent session checks and safe pre-consumption refresh challenges with exponential backoff and jitter. The delay is capped at 30 seconds and the overall automatic retry window is five minutes. Clients do not blindly replay a refresh request after its outcome may have committed.

Transient failure never clears cookies or local DPoP-key material. After five minutes, the client shows an explicit retry action rather than declaring logout. Protected mutations are not automatically replayed.

### Web deployment and relying-party identity

WebAuthn credentials are bound to a relying-party ID and accepted origins. Production must use a stable canonical custom domain before production passkey enrollment is enabled. Registering production passkeys directly under `calibrate.onrender.com` would bind those credentials to that host and complicate a later move to a custom domain.

Production serves the frontend and API from the same canonical origin, with API routes under `/api/v1`. Staging uses a distinct origin and relying-party ID, so staging and production passkeys are intentionally separate.

Local development serves the frontend from `http://localhost:3000` and the API from `http://localhost:3001`. The server explicitly configures the localhost WebAuthn origin and relying-party ID and enables credentialed CORS only for the exact frontend origin. No environment trusts wildcard or sibling origins under `onrender.com`.

Cookie-authenticated state-changing requests, including refresh, validate an exact configured `Origin` and reject missing, `null`, or unexpected values. `SameSite` cookies add defense in depth but do not replace origin validation. HTTPS is mandatory outside the localhost development exception.

### Future native-client transport

A future native client uses platform WebAuthn/passkey APIs. It stores opaque access and refresh tokens in Keychain or Keystore-backed secure storage and sends them through explicit authorization fields rather than cookies. Its DPoP private key is non-exportable and hardware-backed when the platform permits.

Any platform-selection header remains untrusted presentation metadata. It does not prove an official app, grant authorization, or bypass abuse controls. Mobile app attestation is a separate future control.

The application and domain lifecycle remains the same across transports. Presentation adapters must ensure exactly one transport representation is selected and must never return a web credential in JSON.

### Architecture and transaction ownership

Application services coordinate:

- email verification and recovery challenges;
- WebAuthn registration and authentication challenges;
- passkey enrollment and credential management;
- access-session validation and revocation;
- refresh rotation, DPoP verification, and family revocation; and
- passkey re-authentication and family replacement.

They depend on ports for credential verification, proof verification, persistence, email delivery, randomness, clocks, rate limiting, and security notifications.

Presentation owns HTTP validation, WebAuthn wire-format mapping, status codes, cookie creation and clearing, exact-origin enforcement, DPoP header extraction, and mapping application results to shared contracts.

Infrastructure owns PostgreSQL repositories, vetted WebAuthn and JOSE/DPoP adapters, cryptographic randomness and hashing, email delivery, shared rate-limit persistence, notifications, and secret loading. Application policy must not depend directly on a chosen WebAuthn library.

Repositories own transactions in accordance with ADR-0001. The following operations are conditional and atomic:

- challenge attempt increments and consumption;
- user creation plus first passkey binding;
- passkey registration plus recovery completion;
- refresh-token consumption plus successor creation, access-session creation, and family renewal;
- refresh-token reuse detection plus family revocation; and
- recovery-driven revocation of all families plus creation of the replacement family.

### Verification strategy

HTTP-level tests with a fake email sender and a virtual or fake authenticator cover signup, login, logout, recovery, re-authentication, session restoration, and protected-resource ownership.

Focused tests cover:

- invalid, expired, replayed, or wrong-purpose WebAuthn challenges;
- wrong origin, relying-party ID, signature, credential, algorithm, or user-verification flags;
- multiple and synced passkeys, including non-monotonic signature-counter behavior;
- recovery enumeration resistance, attempt limits, limited authorization, global revocation, and notifications;
- access inactivity and absolute expiry;
- refresh inactivity and absolute expiry;
- atomic rotation, concurrent tabs, the bounded `409` path, consumed-token reuse, and family revocation;
- DPoP signature, method, URL, issue time, proactive nonce delivery, missing and stale nonce challenges, fresh-proof retry, proof-ID replay, algorithm, and key binding;
- exact cookie flags and path scoping;
- exact-origin and CSRF rejection;
- transient restoration without credential deletion; and
- absence of raw secrets in persistence, JSON, and logs.

### Abuse controls and operations

Email requests are limited by normalized email, requesting IP, resend cooldown, and a global delivery ceiling. WebAuthn option and verification endpoints, recovery operations, and refresh failures are also rate limited. Production limits are shared across replicas.

Responses do not reveal whether an email or passkey belongs to an account. Internal security events may distinguish outcomes, but logs never include OTP codes, raw session or refresh tokens, private keys, complete DPoP proofs, HMAC keys, or complete cookie values.

Security events include passkey addition or removal, recovery completion, family creation and revocation, refresh-token reuse, repeated DPoP failure, and unusual signature-counter changes. User notifications avoid including secrets.

Expired challenges, authorizations, proofs, sessions, tokens, revoked families, and obsolete rate-limit records are cleaned up according to a retention policy. Consumed refresh-token digests remain available long enough for replay detection and incident investigation.

## Alternatives Considered

### Use email OTP as the primary login method

This avoids WebAuthn integration and works on almost any client, but inbox control becomes the routine authentication proof and every new login depends on email delivery. It is also less phishing resistant and creates more code-entry friction.

Rejected for normal authentication. Email remains mandatory for recovery and initial recovery-address verification.

### Use one long-lived server session

This is simpler and avoids rotation races, but a copied bearer cookie remains useful for a long inactivity and absolute lifetime. It also conflates ordinary request authorization with remembered-device convenience.

Rejected in favor of short access sessions plus a separately constrained renewal credential.

### Use short access sessions with an unbound refresh token

This is common and simpler than DPoP, but a copied refresh token can be replayed from another device until rotation or family-reuse detection reacts.

Rejected because the application has chosen sender-constrained silent renewal. Rotation remains necessary because DPoP alone does not provide token-family replay detection.

### Use JWT access tokens

JWTs allow local validation by multiple services, but Calibrate currently has one authoritative backend and needs immediate revocation and server-side expiry. Refresh persistence would still recreate state.

Rejected for end-user access sessions. Opaque session state better fits the current architecture.

### Use only device-bound or attested passkeys

Restricting credentials to hardware-backed authenticators could increase possession assurance, but it reduces portability, complicates recovery, may expose device or vendor signals, and excludes common synced-passkey workflows.

Rejected initially. User verification is required, but both synced and device-bound passkeys are accepted and attestation is `none`.

### Use a managed identity provider

A provider may offer mature passkeys, recovery, abuse controls, and administration, but adds vendor behavior, configuration, cost, and migration constraints.

Deferred rather than permanently rejected. Reconsider if operating WebAuthn and recovery safely becomes disproportionate or if social, enterprise, or regulated identity is required.

### Store web credentials in browser storage

This lets frontend JavaScript attach tokens directly, but any script executing in the origin can read and export them.

Rejected. Web access and refresh secrets remain in `HttpOnly` cookies; JavaScript holds only the non-extractable DPoP key handle where supported.

### Extend an existing refresh family's absolute expiry after passkey use

This could reduce database records, but it blurs the re-authentication boundary and preserves the old token lineage and device binding.

Rejected. Passkey re-authentication creates a new family and revokes the old one.

## Consequences

- Normal signup, login, and re-authentication are phishing-resistant passkey ceremonies rather than email-code or password flows.
- A user normally interacts with a passkey at initial login, after seven days of inactivity, or at the 30-day absolute boundary, while short access sessions continue to limit ordinary-cookie exposure.
- Email is mandatory for recovery and therefore remains the account's recovery assurance ceiling. Compromise of the recovery inbox can ultimately regain the account.
- Every protected request performs a server-side access-session lookup, and refresh performs a transactional token-family update.
- DPoP reduces off-device use of a stolen refresh cookie but does not stop active same-origin XSS or prove that browser key storage is hardware-backed.
- Strict rotation and replay detection can require passkey re-authentication after an ambiguous lost response. The bounded concurrency response reduces ordinary multi-tab false positives without silently returning the same successor twice.
- A stable production domain becomes an authentication dependency because passkeys are relying-party-bound.
- Passkey support across modern browsers and platforms is sufficient for the primary flow, but detailed UX such as conditional mediation must be progressively enhanced rather than required.
- Recovery, passkey management, and family replacement require security notifications and auditable events.
- Database migrations add WebAuthn challenges, passkey credentials, limited enrollment and recovery authorizations, access sessions, remembered-device families, refresh-token generations, DPoP replay state, email challenges, and shared rate-limit state.
- Password, JWT, and email-OTP-primary paths can be removed after migration. Existing users use verified-email recovery to enroll their first passkey without losing domain data.
- The client must implement session restoration, cross-tab refresh coordination, passkey ceremonies, DPoP proof generation, and explicit re-authentication states.
- Future native clients can share the application lifecycle but require platform-specific secure storage and passkey adapters.

## Explicitly Deferred

- Selection and installation of WebAuthn, CBOR/COSE, JOSE, and DPoP implementation libraries.
- Production transactional-email vendor and sending-domain operations.
- Conditional passkey UI and passkey autofill as a required login path.
- Authenticator attestation, enterprise passkey policy, and device-vendor restrictions.
- Device Bound Session Credentials or other browser-managed session-binding standards.
- User-facing device/family management and remote logout beyond current-family logout and recovery-wide revocation.
- Native mobile UI, concrete Keychain/Keystore libraries, and mobile application attestation.
- Social login, passwords, SMS, authenticator-app OTP, and additional recovery factors.
- High-assurance or regulated clinical identity requirements.

## References

- [W3C Web Authentication: An API for accessing Public Key Credentials, Level 3](https://www.w3.org/TR/webauthn-3/)
- [RFC 9449: OAuth 2.0 Demonstrating Proof of Possession](https://www.rfc-editor.org/rfc/rfc9449.html)
- [RFC 9700 section 4.14.2: Refresh Token Protection](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2)
- [OWASP Session Management Cheat Sheet: Session Expiration](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration)
- [NIST SP 800-63B AAL1 Reauthentication](https://pages.nist.gov/800-63-4/sp800-63b/aal/#aal1reauth)
- [RFC 6265 section 4.1.2.4: Cookie Path](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.4)
