import type { CookieOptions } from "express";

const ENROLLMENT_COOKIE_PATH = "/api/v1/auth/passkeys/registration";
const ENROLLMENT_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

export function getEnrollmentCookieConfiguration(): {
  name: "__Secure-passkey-enrollment" | "passkey-enrollment";
  options: CookieOptions;
} {
  const production = process.env.NODE_ENV === "production";

  return {
    name: production ? "__Secure-passkey-enrollment" : "passkey-enrollment",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: ENROLLMENT_COOKIE_PATH,
      maxAge: ENROLLMENT_COOKIE_MAX_AGE_MS,
    },
  };
}
