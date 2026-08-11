import { getRuntimeEnvironmentValue } from "../../infrastructure/runtime-environment.js";

export function getExpectedWebAuthnOrigin(): string {
  return getRuntimeEnvironmentValue("WEBAUTHN_ORIGIN") ?? "http://localhost:3000";
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
