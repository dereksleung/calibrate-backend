import { apiTransport } from "#/shared/api/api-client";
import { Button } from "#/shared/components/base/Button";
import { setAuthenticatedSession } from "#/verticals/auth/authenticated-session";
import { createBrowserPasskeyRegistrationAdapter, isPasskeyRegistrationCancellation } from "#/verticals/auth/browser-passkey-registration-adapter";
import { isPasskeyAuthenticationCancellation, startPasskeyAuthentication } from "#/verticals/auth/browser-passkey-authentication-adapter";
import {
  authorizeRecoveryRegistration,
  getAccountAccessStatus,
  parseAccountRecoveryError,
  requestIdentifiedPasskeyOptions,
  requestRecoveryRegistrationOptions,
  verifyIdentifiedPasskey,
  verifyRecoveryRegistration,
} from "@calibrate/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

type View = "choose" | "confirm" | "register";

export function LoginRecoveryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("choose");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["account-access-status"], queryFn: () => getAccountAccessStatus(apiTransport), retry: false });
  const identified = useMutation({ mutationFn: () => requestIdentifiedPasskeyOptions(apiTransport), retry: false });
  const startRecovery = useMutation({ mutationFn: (mode: "create" | "replace-provisional") => authorizeRecoveryRegistration(apiTransport, { mode }), retry: false });
  const recoveryOptions = useMutation({ mutationFn: () => requestRecoveryRegistrationOptions(apiTransport), retry: false });
  const recoveryVerify = useMutation({ mutationFn: verifyRecoveryRegistration.bind(null, apiTransport), retry: false });

  async function usePasskey() {
    setMessage(null);
    try {
      const options = await identified.mutateAsync();
      const credential = await startPasskeyAuthentication(options.options, "explicit");
      const session = await verifyIdentifiedPasskey(apiTransport, { credential, rememberDevice });
      setAuthenticatedSession(queryClient, session);
      await navigate({ to: "/" });
    } catch (error) {
      if (isPasskeyAuthenticationCancellation(error)) { setMessage("Passkey request cancelled. Recovery has not started."); return; }
      setMessage(parseAccountRecoveryError(error) === "NO_REGISTERED_PASSKEYS" ? "No passkey is available for this account." : "We couldn’t verify that passkey. You can try again or start recovery.");
    }
  }

  async function createRecoveryPasskey() {
    setMessage(null);
    try {
      await startRecovery.mutateAsync(status.data?.activeRecovery.state === "provisional" ? "replace-provisional" : "create");
      setView("register");
      const options = await recoveryOptions.mutateAsync();
      const credential = await createBrowserPasskeyRegistrationAdapter().createPasskey(options);
      const session = await recoveryVerify.mutateAsync({ credential, rememberDevice });
      setAuthenticatedSession(queryClient, session);
      await navigate({ to: "/" });
    } catch (error) {
      if (isPasskeyRegistrationCancellation(error)) { setMessage("Passkey creation was cancelled. Your current recovery state was not changed."); setView("choose"); return; }
      const code = parseAccountRecoveryError(error);
      setMessage(code === "RECOVERY_REGISTRATION_AUTHORIZATION_REQUIRED" ? "Your recovery authorization expired. Verify your email again." : "We couldn’t create that recovery passkey. Start a fresh ceremony and try again.");
      setView("choose");
    }
  }

  if (status.isPending) return <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter text-on-background"><p role="status">Checking secure account access…</p></main>;
  if (status.isError) return <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter text-on-background"><section className="glass-card w-full max-w-[32rem] rounded-4xl p-xl text-center"><h1 className="font-heading text-3xl font-light text-primary">Verify your email again</h1><p className="mt-md text-on-surface-variant">This account access link is no longer available.</p><Button className="mt-xl" onClick={() => void navigate({ to: "/signup-login" })}>Back to sign in</Button></section></main>;

  const hasPasskeys = status.data?.hasRegisteredPasskeys ?? false;
  const isReplacing = status.data?.activeRecovery.state === "provisional";
  return <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter text-on-background"><section className="glass-card w-full max-w-[32rem] rounded-4xl p-xl"><h1 className="font-heading text-3xl font-light text-primary">Choose how to continue</h1><p className="mt-sm text-on-surface-variant">Verified email: {status.data?.email}</p>{message ? <p role="status" className="mt-md text-sm text-on-surface-variant">{message}</p> : null}
    {view === "choose" ? <div className="mt-xl space-y-md"><p className="text-sm text-on-surface-variant">{hasPasskeys ? "Use a passkey from this device, another device, or a security key." : "This account has no active passkey. Create a recovery passkey to continue."}</p>{hasPasskeys ? <Button className="w-full" disabled={identified.isPending} onClick={() => void usePasskey()}>{identified.isPending ? "Waiting for your passkey…" : "Use a passkey"}</Button> : null}<Button className="w-full" variant="secondary" onClick={() => setView("confirm")}>{isReplacing ? "Replace recovery passkey" : "I can’t use a passkey"}</Button><label className="flex items-center gap-sm text-sm text-on-surface-variant"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />Keep me signed in on this device</label></div> : null}
    {view === "confirm" ? <div className="mt-xl space-y-md"><h2 className="font-heading text-xl text-primary">{isReplacing ? "Replace your recovery passkey" : "Create a recovery passkey"}</h2><p className="text-sm text-on-surface-variant">You’ll have ordinary account access immediately. For five days, this passkey cannot change recovery details, manage passkeys, revoke other devices, export all data, or complete account recovery. Existing passkeys and sessions remain active, and a trusted passkey can cancel this recovery.</p><div className="flex gap-md"><Button variant="secondary" onClick={() => setView("choose")}>Back to passkey login</Button><Button disabled={startRecovery.isPending || recoveryOptions.isPending || recoveryVerify.isPending} onClick={() => void createRecoveryPasskey()}>{recoveryVerify.isPending ? "Registering passkey…" : "Create a recovery passkey"}</Button></div></div> : null}
    {view === "register" ? <p role="status" className="mt-xl text-on-surface-variant">Follow your browser’s passkey prompt. Do not close this page until it completes.</p> : null}
  </section></main>;
}
