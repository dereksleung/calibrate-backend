export class PasskeyAuthenticationRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Passkey authentication rate limited");
    this.name = "PasskeyAuthenticationRateLimitedError";
  }
}

export class PasskeyAuthenticationUnavailableError extends Error {
  constructor() {
    super("Passkey authentication unavailable");
    this.name = "PasskeyAuthenticationUnavailableError";
  }
}

export class PasskeyAuthenticationFailedError extends Error {
  constructor() {
    super("Passkey authentication failed");
    this.name = "PasskeyAuthenticationFailedError";
  }
}

export class PasskeyAuthenticationStateConflictError extends Error {
  constructor() {
    super("Passkey authentication state conflict");
    this.name = "PasskeyAuthenticationStateConflictError";
  }
}
