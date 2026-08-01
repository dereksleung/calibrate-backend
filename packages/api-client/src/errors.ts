export interface ApiErrorOptions {
  status: number;
  statusText: string;
  body: unknown;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;

  constructor({ status, statusText, body, retryAfterSeconds }: ApiErrorOptions) {
    super(statusText || `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
