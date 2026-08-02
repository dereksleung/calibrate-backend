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

export async function signalUnknownPasskeyCredential({
  credentialId,
  rpId,
}: {
  credentialId: string;
  rpId: string;
}): Promise<void> {
  if (typeof window === "undefined" || typeof window.PublicKeyCredential?.signalUnknownCredential !== "function") {
    return;
  }

  try {
    await window.PublicKeyCredential.signalUnknownCredential({ credentialId, rpId });
  } catch {
    // Signaling is advisory. Preserve the registration failure as the actionable outcome.
  }
}

export function isPasskeyRegistrationCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = (error as { name?: string }).name;
  return name === "NotAllowedError" || name === "AbortError" || name === "TimeoutError";
}
