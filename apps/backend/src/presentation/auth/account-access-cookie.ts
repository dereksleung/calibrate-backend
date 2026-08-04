import type { CookieOptions } from "express";

const MAX_AGE_MS = 15 * 60 * 1000;

export function getAccountAccessCookieConfiguration(): {
  name: "__Secure-account-access" | "account-access";
  options: CookieOptions;
} {
  const production = process.env.NODE_ENV === "production";
  return {
    name: production ? "__Secure-account-access" : "account-access",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/api/v1/auth/account-access",
      maxAge: MAX_AGE_MS,
    },
  };
}
