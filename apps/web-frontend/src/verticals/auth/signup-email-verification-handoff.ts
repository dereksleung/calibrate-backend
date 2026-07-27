import {
  RequestSignupEmailVerificationRequestBodySchema,
  RequestSignupEmailVerificationResponseSchema,
  type RequestSignupEmailVerificationResponse,
} from "@calibrate/api-contracts";

export interface SignupEmailVerificationHandoff extends RequestSignupEmailVerificationResponse {
  email: string;
  requestedAtEpochMs: number;
}

declare module "@tanstack/history" {
  interface HistoryState {
    signupEmailVerification?: SignupEmailVerificationHandoff;
  }
}

export function createSignupEmailVerificationHandoff(
  email: string,
  response: RequestSignupEmailVerificationResponse,
  requestedAtEpochMs = Date.now(),
): SignupEmailVerificationHandoff {
  const normalizedEmail = RequestSignupEmailVerificationRequestBodySchema.parse({
    email,
  }).email;
  const metadata = RequestSignupEmailVerificationResponseSchema.parse(response);

  if (!Number.isSafeInteger(requestedAtEpochMs) || requestedAtEpochMs < 0) {
    throw new Error("Invalid signup email verification request timestamp");
  }

  return {
    email: normalizedEmail,
    ...metadata,
    requestedAtEpochMs,
  };
}

export function parseSignupEmailVerificationHandoff(value: unknown): SignupEmailVerificationHandoff | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const expectedKeys = new Set([
    "email",
    "challengeId",
    "expiresInSeconds",
    "resendAfterSeconds",
    "requestedAtEpochMs",
  ]);

  if (Object.keys(candidate).some((key) => !expectedKeys.has(key))) return null;

  const email = RequestSignupEmailVerificationRequestBodySchema.safeParse({
    email: candidate.email,
  });
  const metadata = RequestSignupEmailVerificationResponseSchema.safeParse({
    challengeId: candidate.challengeId,
    expiresInSeconds: candidate.expiresInSeconds,
    resendAfterSeconds: candidate.resendAfterSeconds,
  });

  if (
    !email.success ||
    !metadata.success ||
    typeof candidate.requestedAtEpochMs !== "number" ||
    !Number.isSafeInteger(candidate.requestedAtEpochMs) ||
    candidate.requestedAtEpochMs < 0
  ) {
    return null;
  }

  return {
    email: email.data.email,
    ...metadata.data,
    requestedAtEpochMs: candidate.requestedAtEpochMs,
  };
}
