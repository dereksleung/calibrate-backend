import type { CookieOptions } from "express";

const MAX_AGE_MS = 15 * 60 * 1000;

export function getRecoveryRegistrationCookieConfiguration(): {
  name: "__Secure-recovery-registration" | "recovery-registration";
  options: CookieOptions;
} {
  const production = process.env.NODE_ENV === "production";
  return {
    name: production ? "__Secure-recovery-registration" : "recovery-registration",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/api/v1/auth/recovery/passkeys/registration",
      maxAge: MAX_AGE_MS,
    },
  };
}
