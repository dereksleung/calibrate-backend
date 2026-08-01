import type { CookieOptions } from "express";

const REFRESH_COOKIE_PATH = "/api/v1/auth/session";

export function getRefreshCookieConfiguration(): {
  name: "__Secure-calibrate-refresh" | "calibrate-refresh";
  options: CookieOptions;
} {
  const production = process.env.NODE_ENV === "production";

  return {
    name: production ? "__Secure-calibrate-refresh" : "calibrate-refresh",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
    },
  };
}

export function getRefreshCookieMaxAgeMs(
  familyInactivityExpiresAt: Date,
  familyAbsoluteExpiresAt: Date,
  now: Date,
): number {
  const cappedExpiryMs = Math.min(
    familyInactivityExpiresAt.getTime(),
    familyAbsoluteExpiresAt.getTime(),
  );
  return Math.max(0, cappedExpiryMs - now.getTime());
}
