export class ServiceUnavailableError extends Error {
  constructor(message = "Service temporarily unavailable") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}
