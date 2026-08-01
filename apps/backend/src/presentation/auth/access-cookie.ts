import type { CookieOptions } from "express";

const ACCESS_COOKIE_PATH = "/";

export function getAccessCookieConfiguration(): {
  name: "__Host-calibrate-access" | "calibrate-access";
  options: CookieOptions;
} {
  const production = process.env.NODE_ENV === "production";

  return {
    name: production ? "__Host-calibrate-access" : "calibrate-access",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: ACCESS_COOKIE_PATH,
    },
  };
}

export function getAccessCookieMaxAgeMs(inactivityExpiresAt: Date, now: Date): number {
  return Math.max(0, inactivityExpiresAt.getTime() - now.getTime());
}
