import type { PasskeyRegistrationOptionsResponse, RegistrationResponseJSON } from "@calibrate/api-contracts";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";

export interface BrowserPasskeyRegistrationAdapter {
  createPasskey(options: PasskeyRegistrationOptionsResponse): Promise<RegistrationResponseJSON>;
}

export function isBrowserPasskeyRegistrationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  );
}

export function createBrowserPasskeyRegistrationAdapter(): BrowserPasskeyRegistrationAdapter {
  return {
    async createPasskey(options) {
      const credential = await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      return credential as RegistrationResponseJSON;
    },
  };
}

export function isPasskeyRegistrationCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = (error as { name?: string }).name;
  return name === "NotAllowedError" || name === "AbortError" || name === "TimeoutError";
}
