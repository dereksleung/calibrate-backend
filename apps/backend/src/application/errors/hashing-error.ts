export class HashingError extends Error {
  constructor(message: string = "Password hashing operation failed") {
    super(message);
    this.name = "HashingError";
  }
}
