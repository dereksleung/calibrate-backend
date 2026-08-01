export class EnrollmentAuthorizationRequiredError extends Error {
  constructor() {
    super("Enrollment authorization required");
    this.name = "EnrollmentAuthorizationRequiredError";
  }
}

export class OriginNotAllowedError extends Error {
  constructor() {
    super("Origin not allowed");
    this.name = "OriginNotAllowedError";
  }
}

export class PasskeyRegistrationFailedError extends Error {
  constructor() {
    super("Passkey registration failed");
    this.name = "PasskeyRegistrationFailedError";
  }
}

export class PasskeyRegistrationStateConflictError extends Error {
  constructor() {
    super("Passkey registration state conflict");
    this.name = "PasskeyRegistrationStateConflictError";
  }
}

export class PasskeyRegistrationRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Passkey registration rate limited");
    this.name = "PasskeyRegistrationRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PasskeyRegistrationUnavailableError extends Error {
  constructor() {
    super("Passkey registration unavailable");
    this.name = "PasskeyRegistrationUnavailableError";
  }
}
