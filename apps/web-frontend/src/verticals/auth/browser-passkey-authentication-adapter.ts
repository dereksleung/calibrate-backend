import type {
  AuthenticationResponseJSON,
  PasskeyAuthenticationOptionsResponse,
} from "@calibrate/api-contracts";
import {
  startAuthentication,
  WebAuthnAbortService,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export interface BrowserPasskeyAuthenticationAdapter {
  authenticate(
    options: PasskeyAuthenticationOptionsResponse["options"],
    mode: "conditional" | "explicit",
  ): Promise<AuthenticationResponseJSON>;
  cancel(): void;
}

export function isBrowserPasskeyAuthenticationSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

export async function isConditionalPasskeyAuthenticationSupported(): Promise<boolean> {
  if (!isBrowserPasskeyAuthenticationSupported()) return false;
  return window.PublicKeyCredential.isConditionalMediationAvailable?.() ?? false;
}

export function createBrowserPasskeyAuthenticationAdapter(): BrowserPasskeyAuthenticationAdapter {
  return {
    async authenticate(options, mode) {
      return startAuthentication({
        optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
        useBrowserAutofill: mode === "conditional",
      }) as Promise<AuthenticationResponseJSON>;
    },
    cancel() {
      WebAuthnAbortService.cancelCeremony();
    },
  };
}

export function isPasskeyAuthenticationCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "NotAllowedError" || name === "AbortError" || name === "TimeoutError";
}
