import { apiTransport } from "#/shared/api/api-client";
import { Button } from "#/shared/components/base/Button";
import { WarningBanner } from "#/shared/components/base/WarningBanner";
import { setAuthenticatedSession } from "#/verticals/auth/authenticated-session";
import {
  createBrowserPasskeyRegistrationAdapter,
  isBrowserPasskeyRegistrationSupported,
  isPasskeyRegistrationCancellation,
  showPlatformUiForClientPasskeyFailedToRegisterOnServer,
  type BrowserPasskeyRegistrationAdapter,
} from "#/verticals/auth/browser-passkey-registration-adapter";
import type { PasskeyEnrollmentHandoff } from "#/verticals/auth/account-email-verification-handoff";
import {
  ApiError,
  parsePasskeyRegistrationError,
  requestPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "@calibrate/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type EnrollmentUiState =
  | { kind: "ready" }
  | { kind: "unsupported" }
  | { kind: "expired" }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "ENROLLMENT_AUTHORIZATION_REQUIRED" }
  | { kind: "ORIGIN_NOT_ALLOWED" }
  | { kind: "PASSKEY_REGISTRATION_FAILED" }
  | { kind: "PASSKEY_REGISTRATION_STATE_CONFLICT" }
  | { kind: "PASSKEY_REGISTRATION_UNAVAILABLE" }
  | { kind: "PASSKEY_REGISTRATION_RATE_LIMITED"; retryAfterSeconds: number }
  | { kind: "ambiguous" };

export function PasskeyEnrollmentPage({
  handoff,
  browserRegistration = createBrowserPasskeyRegistrationAdapter(),
  // For Storybook
  initialUiState,
}: {
  handoff: PasskeyEnrollmentHandoff;
  browserRegistration?: BrowserPasskeyRegistrationAdapter;
  initialUiState?: EnrollmentUiState;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isClientPasskeyFailedToRegisterOnServer, setIsClientPasskeyFailedToRegisterOnServer] =
    useState(false);
  const [uiState, setUiState] = useState<EnrollmentUiState>(() => {
    if (initialUiState) return initialUiState;
    return new Date(handoff.expiresAt).getTime() <= Date.now()
      ? { kind: "expired" }
      : { kind: "ready" };
  });

  const { isPending: isRequestOptionsPending, mutateAsync: requestOptions } = useMutation({
    mutationKey: ["requestPasskeyRegistrationOptions"],
    mutationFn: () => requestPasskeyRegistrationOptions(apiTransport),
    retry: false,
  });

  const { isPending: isVerificationPending, mutateAsync: verifyRegistration } = useMutation({
    mutationKey: ["verifyPasskeyRegistration"],
    mutationFn: (input: Parameters<typeof verifyPasskeyRegistration>[1]) =>
      verifyPasskeyRegistration(apiTransport, input),
    retry: false,
  });

  useEffect(() => {
    // If initialUiState is defined, this is a Storybook story for testing
    if (initialUiState) return;

    if (uiState.kind !== "ready") {
      return;
    }
    if (!isBrowserPasskeyRegistrationSupported()) {
      setUiState({ kind: "unsupported" });
    }
  }, [uiState.kind]);

  useEffect(() => {
    if (uiState.kind !== "PASSKEY_REGISTRATION_RATE_LIMITED") return;

    const interval = window.setInterval(() => {
      setUiState((current) => {
        if (current.kind !== "PASSKEY_REGISTRATION_RATE_LIMITED") return current;
        return current.retryAfterSeconds > 1
          ? { ...current, retryAfterSeconds: current.retryAfterSeconds - 1 }
          : { kind: "ready" };
      });
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [uiState.kind]);

  async function runCeremony() {
    // Process restarted, so error state is no longer relevant.
    if (isClientPasskeyFailedToRegisterOnServer) setIsClientPasskeyFailedToRegisterOnServer(false);
    if (new Date(handoff.expiresAt).getTime() <= Date.now()) {
      setUiState({ kind: "expired" });
      return;
    }

    setUiState({ kind: "pending" });

    let createdCredential: { credentialId: string; rpId: string } | undefined;

    try {
      const options = await requestOptions();
      const credential = await browserRegistration.createPasskey(options);
      createdCredential = {
        credentialId: credential.id,
        rpId: options.rp?.id ?? window.location.hostname,
      };
      const session = await verifyRegistration({
        credential,
        rememberDevice,
      });
      setAuthenticatedSession(queryClient, session);
      await navigate({ to: "/" });
    } catch (error) {
      if (isPasskeyRegistrationCancellation(error)) {
        setUiState({ kind: "cancelled" });
        return;
      }

      const code = parsePasskeyRegistrationError(error);

      // On the surface, the UI state can look like it duplicates error state found in the mutation errors.
      // However, not every error comes from the mutations, some come from the WebAuthn API or browser.
      // So using error uiStates throughout this catch block
      // centralizes where we trigger new UI based on any error from the entire ceremony.
      // Allowing uiState to be the single source of truth for the UI models all possible states
      // and optimizes for easy understanding.
      switch (code) {
        case "PASSKEY_REGISTRATION_FAILED":
          if (createdCredential) {
            if (typeof window?.PublicKeyCredential?.signalUnknownCredential === "function") {
              await showPlatformUiForClientPasskeyFailedToRegisterOnServer(createdCredential);
            } else {
              // Fallback UI in case browser does not support showing registering server-side failed
              setIsClientPasskeyFailedToRegisterOnServer(true);
            }
          }
          setUiState({ kind: "PASSKEY_REGISTRATION_FAILED" });
          return;
        case "ENROLLMENT_AUTHORIZATION_REQUIRED":
        case "ORIGIN_NOT_ALLOWED":
        case "PASSKEY_REGISTRATION_STATE_CONFLICT":
        case "PASSKEY_REGISTRATION_UNAVAILABLE":
          setUiState({ kind: code });
          return;
        case "PASSKEY_REGISTRATION_RATE_LIMITED":
          setUiState({
            kind: code,
            retryAfterSeconds:
              error instanceof ApiError && error.retryAfterSeconds ? error.retryAfterSeconds : 60,
          });
          return;
        default:
          setUiState({ kind: "ambiguous" });
      }
    }
  }

  const isPending = uiState.kind === "pending" || isRequestOptionsPending || isVerificationPending;

  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter py-xl text-on-background">
      <section
        className="glass-card w-full max-w-[32rem] rounded-4xl p-lg text-center md:p-xl"
        aria-busy={isPending}
      >
        <h1 className="font-heading text-3xl font-light text-primary">Set up your passkey</h1>
        <p className="mt-md text-sm text-on-surface-variant">
          Create a passkey for{" "}
          <span className="font-semibold text-on-background">{handoff.email}</span> to finish
          signing up.
        </p>

        {isClientPasskeyFailedToRegisterOnServer && (
          <div className="mt-lg space-y-md">
            <WarningBanner className="mt-lg">
              Your passkey was created on this device, but it was not registered with our server.
              Please delete the existing one and try again.
            </WarningBanner>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {uiState.kind === "PASSKEY_REGISTRATION_RATE_LIMITED" && (
          <div className="mt-lg space-y-md">
            <WarningBanner>
              Too many passkey attempts. Wait {uiState.retryAfterSeconds}{" "}
              {uiState.retryAfterSeconds === 1 ? "second" : "seconds"}, then try again.
            </WarningBanner>
            <Button className="w-full" disabled onClick={() => void runCeremony()}>
              Try again in {uiState.retryAfterSeconds}{" "}
              {uiState.retryAfterSeconds === 1 ? "second" : "seconds"}
            </Button>
          </div>
        )}

        {uiState.kind === "unsupported" && (
          <WarningBanner className="mt-lg">
            This browser does not support passkey creation. Try a current version of Chrome, Safari,
            or Edge.
          </WarningBanner>
        )}

        {uiState.kind === "expired" && (
          <div className="mt-lg space-y-md">
            <WarningBanner>Your enrollment window has expired.</WarningBanner>
            <Button className="w-full" onClick={() => void navigate({ to: "/signup-login" })}>
              Start again
            </Button>
          </div>
        )}

        {uiState.kind === "ENROLLMENT_AUTHORIZATION_REQUIRED" && (
          <div className="mt-lg space-y-md">
            <WarningBanner>
              Your enrollment authorization expired or can no longer be used. Verify your email
              again to continue.
            </WarningBanner>
            <Button className="w-full" onClick={() => void navigate({ to: "/signup-login" })}>
              Start again
            </Button>
          </div>
        )}

        {uiState.kind === "ORIGIN_NOT_ALLOWED" && (
          <WarningBanner className="mt-lg">
            Passkey setup cannot continue from this site. Open Calibrate from your usual web
            address.
          </WarningBanner>
        )}

        {uiState.kind === "cancelled" && (
          <div className="mt-lg space-y-md">
            <p className="text-sm text-on-surface-variant">
              Passkey creation was cancelled or timed out.
            </p>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {uiState.kind === "PASSKEY_REGISTRATION_FAILED" && (
          <div className="mt-lg space-y-md">
            <WarningBanner>Passkey verification failed. </WarningBanner>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {(uiState.kind === "PASSKEY_REGISTRATION_STATE_CONFLICT" ||
          uiState.kind === "ambiguous" ||
          uiState.kind === "PASSKEY_REGISTRATION_UNAVAILABLE") && (
          <div className="mt-lg space-y-md">
            <WarningBanner>
              {uiState.kind === "PASSKEY_REGISTRATION_UNAVAILABLE"
                ? "Passkey registration is temporarily unavailable."
                : "Something went wrong while creating your passkey. Please try again."}
            </WarningBanner>
            {uiState.kind !== "PASSKEY_REGISTRATION_UNAVAILABLE" && (
              <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {(uiState.kind === "ready" || uiState.kind === "pending") && (
          <div className="mt-xl space-y-lg">
            <label className="flex items-start gap-sm text-left text-sm text-on-surface-variant">
              <input
                aria-label="Keep me signed in on this device"
                checked={rememberDevice}
                className="mt-0.5 size-4 rounded border-border"
                disabled={isPending}
                type="checkbox"
                onChange={(event) => setRememberDevice(event.target.checked)}
              />
              <span>
                <span className="font-semibold text-on-background">
                  Keep me signed in on this device
                </span>
                <span className="mt-xs block text-xs text-on-surface-variant/80">
                  On a shared device, leave this unchecked.
                </span>
              </span>
            </label>

            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              {isPending ? "Creating your passkey…" : "Create passkey"}
            </Button>

            {isPending && (
              <p className="text-xs text-on-surface-variant" role="status">
                Follow your device prompt, then we will finish securing your account.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
