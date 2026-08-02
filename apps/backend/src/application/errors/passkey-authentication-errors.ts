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
