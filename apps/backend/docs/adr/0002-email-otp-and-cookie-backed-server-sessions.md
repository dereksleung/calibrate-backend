# ADR-0002: Use passkeys, short access sessions, and rotating refresh tokens

## Status

Accepted

## Date

2026-07-12

## Last Updated

2026-07-30

## Context

The backend currently has authentication code for passwords, email OTP, and bearer-style sessions at different stages of migration. The intended end state needs one coherent lifecycle rather than another compatibility layer.

Calibrate is a first-party consumer application whose primary authenticated workflow is recording food throughout the day. It currently stores sensitive consumer wellness data, including food, weight, and habit history, but does not provide clinician workflows, diagnoses, treatment, medication management, or regulated clinical record keeping. A user should not have to repeat full authentication every morning, but a credential that authorizes ordinary API calls should not remain valid for weeks or months.

The security model therefore separates three concerns:

1. A passkey proves the user is present and has unlocked an authenticator. It is used for signup, login, re-authentication, and security-sensitive credential management.
2. A short opaque access session authorizes ordinary API calls and limits the useful lifetime of a stolen browser cookie.
3. A remembered-device family preserves convenient sign-in across access-session expiration. Its one-time refresh token is rotated whenever it is used, and reuse detection revokes the family when a consumed token is presented outside the bounded concurrency accommodation.

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
| Refresh token | One-time bearer secret within a remembered-device family | Inherits the family limit | Inherits the family limit | Rotated after every successful use |

The access-session limits and remembered-device limits serve different purposes. The 30-minute inactivity and 8-hour absolute access-session limits follow the short web-session model described by OWASP. The 7-day inactivity and 30-day absolute limits apply only to silent renewal. They do not make one access credential valid for seven or 30 days.

The 30-day remembered-device absolute limit is a re-authentication boundary. It is never extended by refresh-token use. A successful passkey re-authentication creates a new family and resets that boundary.

### MVP threat model and security boundary

The MVP protects sensitive consumer wellness data rather than financial accounts, provider-managed clinical records, or privileged enterprise administration. The primary harms are disclosure of private food and weight history, unauthorized modification or deletion, and temporary impersonation. Persistent account takeover is a higher-impact outcome and is constrained through recent passkey authentication for credential and other sensitive account operations.

The session design treats the following as in scope:

- remote web attacks, including cross-site scripting, cross-site request forgery, and authorization bypass;
- accidental disclosure through application, reverse-proxy, hosting, observability, analytics, or error-reporting systems;
- off-device replay of a copied access or refresh token;
- recovery-email compromise and abuse of recovery workflows;
- lost devices, shared browsers, and the need for server-side revocation; and
- dependency or frontend supply-chain compromise.

A fully compromised operating system, continuously malicious browser extension, attacker-controlled browser, or attacker-controlled production backend cannot be made safe by the session protocol alone. Those cases require containment, detection, notification, and recovery. DPoP also does not prevent active same-origin malicious JavaScript from asking an available browser-held key to sign while the script is executing.

Raw refresh-cookie theft is assessed as low likelihood per individual user when HTTPS, `HttpOnly`, host-only cookie scope, header redaction, and digest-only persistence are correctly enforced, but it remains realistic at scale through malware, malicious extensions, browser-profile theft, or operational logging mistakes. The MVP therefore uses short access sessions, refresh-token rotation, reuse detection, expiry, revocation, and recent-authentication gates without browser DPoP. This deliberately accepts that a copied current refresh token can be replayed off-device until rotation or reuse detection reacts, which is likeliest to happen in the same day when the user logs another meal.

Reassess sender constraining and the overall assurance level before adding financial authority, provider or clinician access, EHR integration, treatment decisions, medication or medical-device data, regulated clinical records, enterprise administration, or evidence that refresh-token replay is occurring in production.

### Passkey-based signup

Use WebAuthn passkeys as the primary credential. Signup requires both a verified recovery email and creation of an initial passkey:

1. The user supplies a normalized email address.
2. The backend sends and verifies a short-lived email code for the `account-email-verification` purpose.
3. Successful verification issues a short-lived, single-use enrollment authorization. It does not create an access session.
4. The client requests WebAuthn registration options under that authorization and calls `navigator.credentials.create()`.
5. The backend verifies the registration response and atomically creates the user, records the verified recovery email, binds the first passkey, consumes the enrollment authorization, and creates the first remembered-device family and access session.

For web signup, the enrollment authorization is delivered only in a dedicated five-minute `HttpOnly`, `Secure`, `SameSite=Strict`, path-scoped cookie. It is not an authenticated session and cannot authorize ordinary APIs. The enrollment cookie is scoped to the passkey-registration API path; the user is created and access/refresh cookies are issued only after successful passkey registration. Existing OTP HMAC verification, one-time consumption, bounded attempts, generic failure responses, client-transport binding, origin restrictions, and digest-only secret storage continue to apply.

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

A remembered-client family is created only when a browser or app installation completes login, recovery, or periodic reauthentication and is issued renewal credentials. Registering an additional passkey adds an authentication credential but does not identify or authorize a new client installation, so it neither creates nor extends a family.

Passkey addition requires a recent successful passkey authentication or a narrowly scoped recovery authorization. Passkey removal requires recent passkey authentication. Users are notified through their verified email when a passkey is added or removed.

### Recent passkey authentication for sensitive operations

A valid access session proves that the request belongs to an authenticated session; it does not by itself authorize persistent account takeover or other high-impact operations. The following operations require a successful passkey assertion within a short, server-enforced recent-authentication window, initially 10 minutes:

- adding or removing a passkey;
- changing the recovery email;
- exporting the complete account data set;
- deleting the account; and
- revoking other remembered-device families.

The server records the verified authentication time and purpose against the current remembered-device family or an equivalent server-side authorization bound to that family. Revoking the family invalidates this state. Client timestamps or UI state are never accepted as proof of recency. A narrowly scoped recovery authorization may add a replacement passkey only through the recovery lifecycle; it does not satisfy recent authentication for unrelated sensitive operations.

Sensitive-operation step-up records recency on the existing authenticated context; it does not create a new remembered-device family, reset the 30-day absolute boundary, or issue new refresh credentials. Ordinary access-session refresh does not update the recent-authentication timestamp. Product features that add a new way to persist access, disclose the complete account, destroy account data, or materially affect another security boundary must be classified as sensitive and added to this policy before shipping.

### Mandatory email recovery

Email OTP is used only to verify the recovery address during signup and to recover an account when no registered passkey is usable. It is not offered as a routine login shortcut.

Recovery follows this lifecycle:

1. The user requests recovery for an email address. The response is generic whether or not an account exists.
2. The backend sends a code for the `account-recovery` purpose.
3. Successful verification issues a short-lived, single-use recovery authorization. It does not create an ordinary access session.
4. The recovery authorization may only start and complete registration of a new passkey for that account.
5. Successful new-passkey registration revokes all access sessions and remembered-device families for the account, creates a new family and access session, and sends a security notification.

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
- creation, last-used, inactivity-expiry, and absolute-expiry timestamps;
- recent passkey-authentication time and purpose, when applicable;
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

The narrow authentication-session path prevents the browser from sending the refresh credential on ordinary API requests while allowing refresh and logout to receive it. `GET /auth/session` ignores it and validates only the access session. Cookie `Path` is delivery scoping, not a security boundary; refresh and logout still validate the exact `Origin`, token state, and family state.

The refresh cookie's expiry is capped by the family's inactivity and absolute expiries. An HTTP localhost environment uses a distinct unprefixed development cookie name if it cannot set `Secure`.

The sign-in UI offers a clear option not to persist the remembered-device credential on a shared device. When persistence is disabled, the refresh cookie omits `Expires` and `Max-Age` so the browser treats it as a session cookie. The server-side family limits still apply and the user may revoke the family normally. When persistence is enabled, the cookie expiry remains capped by both family limits.

The refresh endpoint is a `POST` endpoint outside the ordinary access-session middleware. It intentionally accepts the refresh cookie even when the broader access cookie is also present. Endpoints outside the authentication-session path do not receive the refresh cookie.

On successful refresh, one repository transaction:

1. verifies that the family is active and inside both expiry limits;
2. verifies the current refresh token and its generation;
3. marks the presented refresh token consumed;
4. creates the next refresh-token generation;
5. updates the family inactivity expiry, capped by its absolute expiry;
6. revokes or replaces the previous access session; and
7. creates a new short access session.

Only after the transaction commits does the response set the new refresh and access cookies. Refresh, authentication, and session responses use `Cache-Control: no-store`.

Refresh occurs when the access session needs renewal. Daily use is the expected product pattern, but correctness does not depend on a once-per-day timer: a user may refresh more than once in a day, and a user with a still-valid access session does not rotate merely because a calendar day changed.

### Refresh-token protection rationale

The refresh token is a bearer credential. Possession is sufficient to present it, so its confidentiality in transit, browser storage, infrastructure, and operational tooling is mandatory. The token is never placed in a URL, web JSON, JavaScript-readable storage, application log, trace attribute, analytics event, or error report.

Rotation and family reuse detection are the MVP replay controls. They expose concurrent use of a token generation and cap the lifetime of a copied token lineage. Short access sessions limit ordinary request-cookie exposure, while recent passkey authentication prevents a refresh-only attacker from silently establishing persistent account control through sensitive operations.

Browser DPoP is deferred rather than rejected. It could reduce off-device replay when an attacker obtains only the refresh cookie, but it adds browser-key persistence, nonce handling, proof validation, cross-tab coordination, lost-key recovery, cryptographic dependencies, and additional failure states. It does not stop an active same-origin XSS attacker or a fully compromised client that can invoke the browser-held key. The current product risk does not justify that complexity for the MVP.

### Refresh-token reuse and concurrency

Presenting a consumed refresh token is reuse. The family relationship allows the backend to identify the current descendant token even though only digests are stored.

Reuse outside a tightly bounded concurrent-request window revokes the entire family, including its current refresh token and access sessions. The response clears web cookies and requires passkey authentication. The backend cannot reliably determine whether the older token was replayed by an attacker or retried by the legitimate client, so it fails closed.

Without sender constraining, possession of a consumed token can also be used to trigger family revocation after the concurrency window. This denial-of-service risk is accepted for the MVP because possession of a current token is already sufficient to impersonate the family, and failing closed prevents silent continued replay.

Within a short, fixed, non-sliding concurrency window, a second request presenting the just-consumed token returns `409 REFRESH_ALREADY_ROTATED`. The response sets no cookies, returns no credentials, extends no lifetime, and does not revoke the family. The client must not retry that refresh request with the consumed token. The fixed window is measured from the original consumption time; repeated presentations never restart or extend it.

The web client uses a single-flight refresh coordinator across tabs, such as Web Locks plus `BroadcastChannel`. After `409 REFRESH_ALREADY_ROTATED`, the losing tab waits for the locally coordinated refresh to finish and then calls `GET /auth/session`. JavaScript does not inspect the `HttpOnly` cookies: it observes coordinator completion and lets the browser attach its current shared access cookie to the session check.

- If `GET /auth/session` returns `200`, another local tab installed the successor refresh cookie and new access session. The client continues with that session. It may retry an idempotent read that originally required refresh, but it does not automatically replay a protected mutation.
- If `GET /auth/session` returns `401 ACCESS_SESSION_REQUIRED` after the bounded coordination wait, no usable successor reached this browser. The cause may be an off-device holder winning the rotation or a successful refresh response being lost. The client does not present the consumed token to the refresh endpoint again. It explicitly calls `DELETE /auth/session`, which may use the recognized consumed-token digest solely to identify and revoke the family, clears the local cookies after the idempotent revocation succeeds, and requires passkey authentication to create a new family.
- If the coordination wait or session check fails because of a timeout, network error, or `5xx` response, the client enters the recoverably unavailable state. It does not infer token theft, clear cookies, revoke the family, or replay a protected mutation from an availability failure.

The second requester may be malicious; the backend cannot infer that a request inside the concurrency window came from another tab. It therefore never returns the successor token or access session to the `409` requester. If an off-device attacker won the rotation, the legitimate browser cannot silently recover the attacker-held successor. Explicit family revocation invalidates that successor and its access sessions before passkey authentication creates a replacement family. A holder of a consumed token can abuse this revocation path for denial of service, but that does not grant credentials and is the same accepted bearer-token possession risk described above.

The repository uses row locking or equivalent conditional atomic writes so only one request can consume a generation. Lost responses may require passkey authentication; this is accepted in preference to storing recoverable plaintext successor tokens.

### Thirty-day passkey re-authentication

At the remembered-device family's absolute expiry, the refresh endpoint returns `REAUTHENTICATION_REQUIRED` and does not rotate or extend the family.

The client performs an explicit WebAuthn assertion with `userVerification: "required"`. After success, the backend:

1. revokes the old family and any remaining access sessions under it;
2. creates a new family with new 7-day inactivity and 30-day absolute clocks;
3. issues the first refresh token for the new family; and
4. creates a new short access session.

The old family's absolute timestamp is never rewritten. Creating a new family preserves an auditable security boundary and retires the old refresh-token lineage.

This ceremony requires explicit user interaction with the passkey authenticator; it is not a background refresh. If no passkey is usable, the user follows the email recovery flow.

### HTTP API

Expose these operations under the existing `/api/v1` prefix:

- `POST /auth/email-verification` requests an account-email verification code without disclosing whether the email already has an account.
- `POST /auth/email-verification/verify` atomically consumes a valid code and resolves its continuation: a new email receives a limited enrollment authorization, while an existing email receives only a `login-or-recovery` continuation. The latter is not authentication or recovery authorization; email recovery, its cool-off, and recovered-passkey management remain deferred.
- `POST /auth/passkeys/registration/options` creates passkey-registration options for an enrollment, recovery, or recently authenticated credential-management authorization.
- `POST /auth/passkeys/registration/verify` verifies registration and completes the authorized operation.
- `POST /auth/passkeys/authentication/options` creates usernameless passkey-authentication options.
- `POST /auth/passkeys/authentication/verify` verifies a purpose-bound assertion and completes login, periodic re-authentication, or sensitive-operation step-up.
- `POST /auth/recovery/email` requests an account-recovery email code.
- `POST /auth/recovery/email/verify` verifies that code and creates a limited recovery authorization.
- `POST /auth/recovery-email/change` requests verification of a replacement recovery address after recent passkey authentication.
- `POST /auth/recovery-email/change/verify` verifies and atomically installs the replacement recovery address.
- `POST /auth/session/refresh` verifies the refresh cookie, rotates the refresh token, and creates a new access session.
- `GET /auth/session` validates only the access session and returns the current user.
- `DELETE /auth/session` revokes the current family and its access sessions idempotently, then clears both cookies.

Shared request, response, and error schemas remain owned by the API-contract package. Web JSON never contains access or refresh tokens.

`DELETE /auth/session` is full logout for the current remembered device and is idempotent. A valid access session identifies the family. If only a refresh cookie remains, a recognized current or consumed refresh-token digest may identify the family solely for revocation; expired, revoked, consumed, or otherwise unusable refresh tokens never authorize renewal or credential issuance. If the digest identifies an active family, the endpoint revokes that family and all of its access sessions before clearing both cookies. With no recognized credential, it still clears both cookies without changing server state. Cookie clearing uses the same names, paths, and security attributes used when each cookie was set. A future session-management endpoint may support revoking selected or all other families.

### Session restoration and client states

`GET /auth/session` remains the ordinary startup check:

- `200` returns the authenticated user.
- `401 ACCESS_SESSION_REQUIRED` means the access session is missing or unusable and the client may attempt one coordinated refresh.
- a successful refresh is followed by `GET /auth/session` or returns the same current-user representation by contract;
- `409 REFRESH_ALREADY_ROTATED` follows the bounded concurrency recovery flow: wait for local coordinator completion, check `GET /auth/session`, and explicitly revoke the family and require passkey authentication if no usable successor session reached the browser;
- `REAUTHENTICATION_REQUIRED` presents the passkey ceremony;
- invalid, revoked, or replayed family state presents passkey login; and
- network failures, bounded timeouts, and `5xx` responses are availability failures, not logout decisions.

The client states are checking, authenticated, refreshing, re-authenticating, reconnecting, unauthenticated, and recoverably unavailable. A persisted hint that the client was authenticated may preserve the route shell while checking or reconnecting, but it is never backend proof and cannot authorize protected data or mutations.

For a sleeping backend, clients retry idempotent session checks with exponential backoff and jitter. The delay is capped at 30 seconds and the overall automatic retry window is five minutes. Clients do not blindly replay a refresh request after its outcome may have committed; ambiguous refresh outcomes use the bounded concurrency protocol and may ultimately require passkey re-authentication.

Transient failure never clears cookies. After five minutes, the client shows an explicit retry action rather than declaring logout. Protected mutations are not automatically replayed.

### Web deployment and relying-party identity

WebAuthn credentials are bound to a relying-party ID and accepted origins. Production must use a stable canonical custom domain before production passkey enrollment is enabled. Registering production passkeys directly under `calibrate.onrender.com` would bind those credentials to that host and complicate a later move to a custom domain.

Production serves the frontend and API from the same canonical origin, with API routes under `/api/v1`. Staging uses a distinct origin and relying-party ID, so staging and production passkeys are intentionally separate.

Local development serves the frontend from `http://localhost:3000` and the API from `http://localhost:3001`. The server explicitly configures the localhost WebAuthn origin and relying-party ID and enables credentialed CORS only for the exact frontend origin. No environment trusts wildcard or sibling origins under `onrender.com`.

Cookie-authenticated state-changing requests, including refresh, validate an exact configured `Origin` and reject missing, `null`, or unexpected values. `SameSite` cookies add defense in depth but do not replace origin validation. HTTPS is mandatory outside the localhost development exception.

### Production cookie-authentication shipping gate

Cookie authentication MUST NOT ship or be enabled in production until every control in this section is implemented and verified in a production-equivalent environment. Partial completion is not sufficient.

#### Origin, transport, and browser boundaries

- Production remains same-origin and does not enable unnecessary CORS. Where CORS is required, including localhost development, credentialed CORS uses an explicit per-environment allowlist and returns an allow-origin value only for the exact configured frontend origin. Wildcards, reflected arbitrary origins, `null`, sibling hosting domains, and an unparameterized default CORS configuration are prohibited.
- Every cookie-authenticated state-changing endpoint validates the exact `Origin` server-side before changing credential or application state. Tests reject missing, `null`, malformed, and unexpected origins.
- HTTPS is enforced outside the localhost development exception. Proxy trust is explicitly configured and tested so production requests cannot downgrade secure-cookie decisions through spoofed forwarding headers. HSTS and the planned security headers are present on production responses.
- The production frontend has an enforced Content Security Policy. Script sources are restricted to the minimum required set, unsafe script execution is not enabled for convenience, and third-party scripts are avoided unless separately reviewed.

#### Credential handling

- Integration tests assert the complete access-cookie contract: the production name has the `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, and expiry no later than the server-side access-session limit.
- Integration tests assert the complete refresh-cookie contract: the production name has the `__Secure-` prefix, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth/session`, no `Domain`, and expiry no later than the family's inactivity or absolute limit. The session-only variant omits `Expires` and `Max-Age`.
- Cookie clearing is tested with the same names, paths, and security attributes used when the cookies were created.
- Access and refresh tokens never appear in web JSON, URLs, HTML, `localStorage`, `sessionStorage`, or JavaScript-readable cookies. Authentication responses use `Cache-Control: no-store`.
- PostgreSQL contains only token digests. Raw-token absence is tested in persistence records, application errors, fixtures intended to represent production data, and serialized events.

#### Redaction and operational controls

- `Cookie`, `Set-Cookie`, `Authorization`, email OTP values, raw session tokens, and raw refresh tokens are redacted at every logging boundary, including application logs, reverse-proxy and hosting logs, load balancers, APM, distributed tracing, analytics, error reporting, and support diagnostics.
- Production-equivalent verification sends canary credential values through authentication and refresh requests and confirms that those values do not appear in captured logs, traces, error events, or response bodies.
- Authentication and refresh endpoints have shared production rate limits, enumeration-resistant responses, and security-event recording without raw credentials.
- Secrets and HMAC keys are loaded from the production secret store, never source control, logs, build artifacts, or client bundles.

#### Session correctness and recovery

- HTTP-level tests cover expiry, revocation, exact-origin rejection, atomic rotation, concurrent-tab behavior, the bounded `409` recovery path, consumed-token reuse, family revocation by a recognized consumed token, logout, session restoration, protected-resource ownership, sensitive-operation step-up, and recovery-driven global revocation.
- Repository tests prove that refresh consumption, successor creation, family renewal, prior-access-session replacement, and new-access-session creation commit atomically.
- Recovery, passkey addition or removal, recovery-email changes, and family revocation produce auditable security events and the required user notifications.
- A failed or unavailable session check is not treated as logout, does not clear credentials, and cannot authorize protected data or mutations.

The release checklist must link to passing automated evidence for these controls and to a manual review of production hosting, proxy, observability, and frontend-header configuration. A development-only assertion or an ADR statement is not evidence that the gate has passed.

### Future native-client transport

A future native client uses platform WebAuthn/passkey APIs. It stores opaque access and refresh tokens in Keychain or Keystore-backed secure storage and sends them through explicit authorization fields rather than cookies.

Any platform-selection header remains untrusted presentation metadata. It does not prove an official app, grant authorization, or bypass abuse controls. Mobile app attestation is a separate future control.

The application and domain lifecycle remains the same across transports. Presentation adapters must ensure exactly one transport representation is selected and must never return a web credential in JSON.

### Architecture and transaction ownership

Application services coordinate:

- email verification and recovery challenges;
- WebAuthn registration and authentication challenges;
- passkey enrollment and credential management;
- access-session validation and revocation;
- refresh rotation, reuse detection, and family revocation; and
- passkey re-authentication and family replacement.

They depend on ports for credential verification, persistence, email delivery, randomness, clocks, rate limiting, and security notifications.

Presentation owns HTTP validation, WebAuthn wire-format mapping, status codes, cookie creation and clearing, exact-origin enforcement, and mapping application results to shared contracts.

Infrastructure owns PostgreSQL repositories, vetted WebAuthn adapters, cryptographic randomness and hashing, email delivery, shared rate-limit persistence, notifications, and secret loading. Application policy must not depend directly on a chosen WebAuthn library.

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
- atomic rotation, concurrent tabs, the bounded `409` path for both a local winner and an off-device winner, consumed-token reuse, and family revocation by a recognized consumed token;
- exact cookie flags and path scoping;
- exact-origin and CSRF rejection;
- recent passkey authentication for every sensitive operation;
- transient restoration without credential deletion; and
- absence of raw secrets in persistence, JSON, browser storage, application logs, infrastructure logs, traces, analytics, and error reports.

The production cookie-authentication shipping gate is part of the verification strategy. Its automated tests run with production cookie names and security settings, and its operational checks inspect the deployed proxy, hosting, observability, and frontend-header configuration rather than assuming local middleware configuration is sufficient.

### Abuse controls and operations

Email requests are limited by normalized email, requesting IP, resend cooldown, and a global delivery ceiling. WebAuthn option and verification endpoints, recovery operations, and refresh failures are also rate limited. Production limits are shared across replicas. The five-options-per-enrollment cap is separately a lifetime quota: exhausting it makes that enrollment ineligible to start another ceremony and requires email verification to issue a new enrollment authorization. It does not emit a retryable `429`; `429` remains reserved for temporary endpoint abuse limits with a meaningful `Retry-After`.

Responses do not reveal whether an email or passkey belongs to an account. Internal security events may distinguish outcomes, but logs never include OTP codes, raw session or refresh tokens, passkey material, HMAC keys, authorization headers, or cookie values.

Security events include passkey addition or removal, recovery completion, family creation and revocation, refresh-token reuse, sensitive-operation re-authentication, and unusual signature-counter changes. User notifications avoid including secrets.

Expired challenges, authorizations, sessions, tokens, revoked families, and obsolete rate-limit records are cleaned up according to a retention policy. Consumed refresh-token digests remain available long enough for replay detection and incident investigation.

## Alternatives Considered

### Use email OTP as the primary login method

This avoids WebAuthn integration and works on almost any client, but inbox control becomes the routine authentication proof and every new login depends on email delivery. It is also less phishing resistant and creates more code-entry friction.

Rejected for normal authentication. Email remains mandatory for recovery and initial recovery-address verification.

### Use one long-lived server session

This is simpler and avoids rotation races, but a copied bearer cookie remains useful for a long inactivity and absolute lifetime. It also conflates ordinary request authorization with remembered-device convenience.

Rejected in favor of short access sessions plus a separately scoped and rotating renewal credential.

### Use browser DPoP to sender-constrain refresh tokens

DPoP can prevent off-device replay when an attacker obtains only the refresh token and not the bound private key. It is valuable for higher-impact applications or observed token-theft threats.

Deferred for the MVP because it adds browser key and nonce lifecycle complexity, does not prevent active same-origin XSS or a fully compromised client, and addresses a lower-ranked threat for the current consumer-wellness product. Reconsider at the threat-model triggers defined above.

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

Rejected. Web access and refresh secrets remain in `HttpOnly` cookies and are never exposed to JavaScript.

### Extend an existing refresh family's absolute expiry after passkey use

This could reduce database records, but it blurs the re-authentication boundary and preserves the old token lineage and device binding.

Rejected. Passkey re-authentication creates a new family and revokes the old one.

## Consequences

- Normal signup, login, and re-authentication are phishing-resistant passkey ceremonies rather than email-code or password flows.
- A user normally interacts with a passkey at initial login, after seven days of inactivity, or at the 30-day absolute boundary, while short access sessions continue to limit ordinary-cookie exposure.
- Email is mandatory for recovery and therefore remains the account's recovery assurance ceiling. Compromise of the recovery inbox can ultimately regain the account.
- Every protected request performs a server-side access-session lookup, and refresh performs a transactional token-family update.
- A copied current refresh token remains replayable off-device until rotation or reuse detection reacts; this residual risk is accepted for the MVP.
- Recent passkey authentication prevents a refresh-only attacker from adding credentials, changing the recovery email, exporting the complete account, deleting the account, or revoking other remembered devices.
- Strict rotation and replay detection can require passkey re-authentication after an ambiguous lost response. The bounded concurrency response reduces ordinary multi-tab false positives without silently returning the same successor twice.
- Cookie authentication cannot ship until the production gate's automated and operational evidence is complete.
- A stable production domain becomes an authentication dependency because passkeys are relying-party-bound.
- Passkey support across modern browsers and platforms is sufficient for the primary flow, but detailed UX such as conditional mediation must be progressively enhanced rather than required.
- Recovery, passkey management, and family replacement require security notifications and auditable events.
- Database migrations add WebAuthn challenges, passkey credentials, limited enrollment and recovery authorizations, access sessions, remembered-device families, refresh-token generations, email challenges, and shared rate-limit state.
- Password, JWT, and email-OTP-primary paths can be removed after migration. Existing users use verified-email recovery to enroll their first passkey without losing domain data.
- The client must implement session restoration, cross-tab refresh coordination, passkey ceremonies, sensitive-operation step-up, and explicit re-authentication states.
- Future native clients can share the application lifecycle but require platform-specific secure storage and passkey adapters.

## Explicitly Deferred

- Selection and installation of WebAuthn and CBOR/COSE implementation libraries.
- Browser DPoP or another sender-constraining mechanism for refresh tokens.
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
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet: Data to Exclude](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude)
- [NIST SP 800-63B AAL1 Reauthentication](https://pages.nist.gov/800-63-4/sp800-63b/aal/#aal1reauth)
- [RFC 6265 section 4.1.2.4: Cookie Path](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.4)
