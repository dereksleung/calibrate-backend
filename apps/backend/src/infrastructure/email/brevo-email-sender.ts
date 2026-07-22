import { AuthenticationCodeEmailInfo, IEmailSender, ServiceUnavailableError } from "@application";
import { otpLoginEmailTemplate } from "./otp-login-email-template.js";

/**
 * Requirements for timeout and retry logic:
 * - This is a synchronous endpoint, the user needs to know a result.
 * - 5 second timeout per attempt with jitter
 * - At most 2 attempts
 * - 12-second total budget
 * - Retry only transient failures
 * - Reuse the idempotency key between attempts
 * - Return a success once Brevo accepts the mail with 201, not when the mail reaches the recipient
 */

const TOTAL_BUDGET_MS = 12_000;
const MAX_ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS_BASE = 5_000;

const RETRYABLE_STATUSES = new Set([
  408,
  429,
  500,
  502,
  503,
  504,
]);

const IDEMPOTENT_REQUEST_REPEATED_CODE = "duplicate_parameter";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class BrevoEmailSender implements IEmailSender {
  constructor(private readonly apiKey: string) {}

  // Using normal fetch instead of Brevo's SDK because the SDK does not have a license file
  async sendAuthenticationCode(message: AuthenticationCodeEmailInfo): Promise<void> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
            "Accept": "application/json",
          },
          body: JSON.stringify({
            sender: { 
              name: "Calibrate", 
              email: "noreply.verification.codes@calibrateapp.org",
            },
            to: [{ email: message.email }],
            subject: "Your Calibrate Verification Code",
            htmlContent: otpLoginEmailTemplate,
            params: {
              code: message.code,
            },
            headers: {
              idempotencyKey: message.deliveryId,
            }
          }),
          signal: AbortSignal.timeout(
            Math.min(ATTEMPT_TIMEOUT_MS_BASE, remainingMs)
          ),
        });

        if (response.status === 201) {
          await response.json();
          return;
        }

        if (response.status === 400) {
          const brevoError = await readBrevoError(response);
          // Record safe operational information, but do not log the OTP,
          // API key, complete request body, or recipient address.
          console.error("Brevo rejected transactional email request", {
            status: response.status,
            code: brevoError.code,
          });

          // Treat as success, because this means Brevo already accepted the previous request with that
          // idempotency key, and prevented the duplicate
          if (attempt > 0 && brevoError.code === IDEMPOTENT_REQUEST_REPEATED_CODE) return;

          // Most causes for Brevo API errors for this endpoint are not things the frontend user can fix,
          // such as incorrect sender configuration, malformed template fields, etc.
          // https://developers.brevo.com/reference/send-transac-email#response.error
          throw new ServiceUnavailableError(
            "Email authentication is temporarily unavailable",
          );
        }

        const canRetry = RETRYABLE_STATUSES.has(response.status) && attempt + 1 < MAX_ATTEMPTS;
        if (!canRetry) {
          throw new ServiceUnavailableError("Email authentication is temporarily unavailable.");
        }

        const delayMs = getRetryDelayMs(response, attempt);

        if (delayMs >= deadline - Date.now()) break;

        await sleep(delayMs);

      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          throw error;
        }

        // Fetch rejected: timeout, DNS problem, connection reset, etc.
        if (attempt + 1 >= MAX_ATTEMPTS) break;

        const delayMs = 250 * 2 ** attempt + Math.random() * 250;

        if (delayMs >= deadline - Date.now()) break;

        await sleep(delayMs);
      }
    }

    throw new ServiceUnavailableError(
      "Email authentication is temporarily unavailable",
    );
  }
}

const getRetryDelayMs = (response: Response, attempt: number): number => {
  const resetSeconds = Number(response.headers.get("x-sib-ratelimit-reset"));

  if (response.status === 429 && Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return resetSeconds * 1000;
  }

  return 250 * 2 ** attempt + Math.random() * 250;
}


interface BrevoErrorResponse {
  code?: string;
  message?: string;
}
const readBrevoError = async (response: Response): Promise<BrevoErrorResponse> => {
  try {
    const value: unknown = await response.json();

    if (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof value.code === "string"
    ) {
      return { code: value.code };
    }
  } catch {
    return {};
  }
  return {};
}