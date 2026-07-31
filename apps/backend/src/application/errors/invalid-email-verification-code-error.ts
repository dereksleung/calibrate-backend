export class InvalidEmailVerificationCodeError extends Error {
  constructor() {
    super("Invalid or expired verification code");
    this.name = "InvalidEmailVerificationCodeError";
  }
}
