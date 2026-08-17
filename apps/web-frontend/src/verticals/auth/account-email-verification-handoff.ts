import {
  RequestAccountEmailVerificationRequestBodySchema,
  RequestAccountEmailVerificationResponseSchema,
  VerifyAccountEmailVerificationResponseSchema,
  type RequestAccountEmailVerificationResponse,
} from "@calibrate/api-contracts";

export interface AccountEmailVerificationHandoff extends RequestAccountEmailVerificationResponse {
  email: string;
  requestedAtEpochMs: number;
}

export interface PasskeyEnrollmentHandoff {
  email: string;
  next: "passkey-registration";
  expiresAt: string;
}

export interface LoginRecoveryHandoff {
  email: string;
  next: "login-or-recovery";
}

declare module "@tanstack/history" {
  interface HistoryState {
    accountEmailVerification?: AccountEmailVerificationHandoff;
    passkeyEnrollment?: PasskeyEnrollmentHandoff;
    loginRecovery?: LoginRecoveryHandoff;
  }
}

export function createPasskeyEnrollmentHandoff(
  email: string,
  response: { next: "passkey-registration"; expiresAt: string },
): PasskeyEnrollmentHandoff {
  const parsed = VerifyAccountEmailVerificationResponseSchema.parse(response);
  if (parsed.next !== "passkey-registration") throw new Error("Invalid passkey enrollment continuation");
  return {
    email: RequestAccountEmailVerificationRequestBodySchema.parse({ email }).email,
    ...parsed,
  };
}

export function parsePasskeyEnrollmentHandoff(value: unknown): PasskeyEnrollmentHandoff | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["email", "next", "expiresAt"].includes(key))) return null;
  const email = RequestAccountEmailVerificationRequestBodySchema.safeParse({ email: candidate.email });
  const response = VerifyAccountEmailVerificationResponseSchema.safeParse({
    next: candidate.next,
    expiresAt: candidate.expiresAt,
  });
  return email.success && response.success && response.data.next === "passkey-registration"
    ? { email: email.data.email, ...response.data }
    : null;
}

export function createLoginRecoveryHandoff(email: string): LoginRecoveryHandoff {
  return {
    email: RequestAccountEmailVerificationRequestBodySchema.parse({ email }).email,
    next: "login-or-recovery",
  };
}

export function parseLoginRecoveryHandoff(value: unknown): LoginRecoveryHandoff | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !["email", "next"].includes(key))) return null;
  const email = RequestAccountEmailVerificationRequestBodySchema.safeParse({ email: candidate.email });
  return email.success && candidate.next === "login-or-recovery"
    ? { email: email.data.email, next: "login-or-recovery" }
    : null;
}

export function createAccountEmailVerificationHandoff(
  email: string,
  response: RequestAccountEmailVerificationResponse,
  requestedAtEpochMs = Date.now(),
): AccountEmailVerificationHandoff {
  const normalizedEmail = RequestAccountEmailVerificationRequestBodySchema.parse({
    email,
  }).email;
  const metadata = RequestAccountEmailVerificationResponseSchema.parse(response);

  if (!Number.isSafeInteger(requestedAtEpochMs) || requestedAtEpochMs < 0) {
    throw new Error("Invalid signup email verification request timestamp");
  }

  return {
    email: normalizedEmail,
    ...metadata,
    requestedAtEpochMs,
  };
}

export function parseAccountEmailVerificationHandoff(value: unknown): AccountEmailVerificationHandoff | null {
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

  const email = RequestAccountEmailVerificationRequestBodySchema.safeParse({
    email: candidate.email,
  });
  const metadata = RequestAccountEmailVerificationResponseSchema.safeParse({
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
