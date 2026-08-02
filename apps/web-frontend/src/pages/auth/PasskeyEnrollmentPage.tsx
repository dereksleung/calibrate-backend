import { apiTransport } from "#/shared/api/api-client";
import { Button } from "#/shared/components/base/Button";
import { WarningBanner } from "#/shared/components/base/WarningBanner";
import { setAuthenticatedSession } from "#/verticals/auth/authenticated-session";
import {
  createBrowserPasskeyRegistrationAdapter,
  isBrowserPasskeyRegistrationSupported,
  isPasskeyRegistrationCancellation,
  signalUnknownPasskeyCredential,
  type BrowserPasskeyRegistrationAdapter,
} from "#/verticals/auth/browser-passkey-registration-adapter";
import type { PasskeyEnrollmentHandoff } from "#/verticals/auth/signup-email-verification-handoff";
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
  | { kind: "auth_required" }
  | { kind: "origin_forbidden" }
  | { kind: "conflict" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "unavailable" }
  | { kind: "ambiguous" };

export function PasskeyEnrollmentPage({
  handoff,
  browserRegistration = createBrowserPasskeyRegistrationAdapter(),
}: {
  handoff: PasskeyEnrollmentHandoff;
  browserRegistration?: BrowserPasskeyRegistrationAdapter;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rememberDevice, setRememberDevice] = useState(true);
  const [uiState, setUiState] = useState<EnrollmentUiState>(() =>
    new Date(handoff.expiresAt).getTime() <= Date.now() ? { kind: "expired" } : { kind: "ready" },
  );

  const {
    error: verifyError,
    isPending: isVerificationPending,
    mutateAsync: verifyRegistration,
  } = useMutation({
    mutationKey: ["verifyPasskeyRegistration"],
    mutationFn: (input: Parameters<typeof verifyPasskeyRegistration>[1]) =>
      verifyPasskeyRegistration(apiTransport, input),
    retry: false,
  });
  const isVerificationFailed = parsePasskeyRegistrationError(verifyError) === "PASSKEY_REGISTRATION_FAILED";

  useEffect(() => {
    if (uiState.kind !== "ready") {
      return;
    }
    if (!isBrowserPasskeyRegistrationSupported()) {
      setUiState({ kind: "unsupported" });
    }
  }, [uiState.kind]);

  async function runCeremony() {
    if (new Date(handoff.expiresAt).getTime() <= Date.now()) {
      setUiState({ kind: "expired" });
      return;
    }

    setUiState({ kind: "pending" });

    let createdCredential: { credentialId: string; rpId: string } | undefined;

    try {
      const options = await requestPasskeyRegistrationOptions(apiTransport);
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
      switch (code) {
        case "PASSKEY_REGISTRATION_FAILED":
          if (createdCredential) {
            await signalUnknownPasskeyCredential(createdCredential);
          }
          setUiState({ kind: "ready" });
          return;
        case "ENROLLMENT_AUTHORIZATION_REQUIRED":
          setUiState({ kind: "auth_required" });
          return;
        case "ORIGIN_NOT_ALLOWED":
          setUiState({ kind: "origin_forbidden" });
          return;
        case "PASSKEY_REGISTRATION_STATE_CONFLICT":
          setUiState({ kind: "conflict" });
          return;
        case "PASSKEY_REGISTRATION_RATE_LIMITED":
          setUiState({
            kind: "rate_limited",
            retryAfterSeconds:
              error instanceof ApiError && error.retryAfterSeconds
                ? error.retryAfterSeconds
                : 60,
          });
          return;
        case "PASSKEY_REGISTRATION_UNAVAILABLE":
          setUiState({ kind: "unavailable" });
          return;
        default:
          setUiState({ kind: "ambiguous" });
      }
    }
  }

  const isPending = uiState.kind === "pending" || isVerificationPending;

  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter py-xl text-on-background">
      <section
        className="glass-card w-full max-w-[32rem] rounded-4xl p-lg text-center md:p-xl"
        aria-busy={isPending}
      >
        <h1 className="font-heading text-3xl font-light text-primary">Set up your passkey</h1>
        <p className="mt-md text-sm text-on-surface-variant">
          Create a passkey for <span className="font-semibold text-on-background">{handoff.email}</span> to
          finish signing up.
        </p>

        {uiState.kind === "unsupported" && (
          <WarningBanner className="mt-lg">
            This browser does not support passkey creation. Try a current version of Chrome, Safari, or Edge.
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

        {uiState.kind === "auth_required" && (
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

        {uiState.kind === "origin_forbidden" && (
          <WarningBanner className="mt-lg">
            Passkey setup cannot continue from this site. Open Calibrate from your usual web address.
          </WarningBanner>
        )}

        {uiState.kind === "cancelled" && (
          <div className="mt-lg space-y-md">
            <p className="text-sm text-on-surface-variant">Passkey creation was cancelled or timed out.</p>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {isVerificationFailed && (
          <div className="mt-lg space-y-md">
            <WarningBanner>Passkey verification failed. Start a fresh ceremony to try again.</WarningBanner>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {uiState.kind === "rate_limited" && (
          <div className="mt-lg space-y-md">
            <WarningBanner>
              Too many passkey attempts. Wait {uiState.retryAfterSeconds} seconds, then try again if enrollment
              is still active.
            </WarningBanner>
            <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
              Try again
            </Button>
          </div>
        )}

        {(uiState.kind === "conflict" || uiState.kind === "ambiguous" || uiState.kind === "unavailable") && (
          <div className="mt-lg space-y-md">
            <WarningBanner>
              {uiState.kind === "unavailable"
                ? "Passkey registration is temporarily unavailable."
                : "Something went wrong while creating your passkey. Start a fresh ceremony to continue."}
            </WarningBanner>
            {uiState.kind !== "unavailable" && (
              <Button className="w-full" disabled={isPending} onClick={() => void runCeremony()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {(uiState.kind === "ready" || uiState.kind === "pending") && !isVerificationFailed && (
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
                <span className="font-semibold text-on-background">Keep me signed in on this device</span>
                <span className="mt-xs block text-xs text-on-surface-variant/80">
                  On a shared device, leave this unchecked so your refresh credential is not persisted in the
                  browser.
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
