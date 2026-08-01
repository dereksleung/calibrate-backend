import dotenvx from "@dotenvx/dotenvx";

export function getExpectedWebAuthnOrigin(): string {
  return dotenvx.get("WEBAUTHN_ORIGIN") ?? "http://localhost:3000";
}

export function readRequestOrigin(originHeader: string | undefined): string | null {
  if (!originHeader || originHeader === "null") {
    return null;
  }

  try {
    const url = new URL(originHeader);
    return url.origin;
  } catch {
    return null;
  }
}
