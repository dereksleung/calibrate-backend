export class PasskeyAuthenticationRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Passkey authentication rate limited");
    this.name = "PasskeyAuthenticationRateLimitedError";
  }
}
