import { Button } from "#/shared/components/base/Button";
import type { PasskeyEnrollmentHandoff } from "#/verticals/auth/signup-email-verification-handoff";
import { useNavigate } from "@tanstack/react-router";

export function PasskeyEnrollmentPage({ handoff }: { handoff: PasskeyEnrollmentHandoff }) {
  const navigate = useNavigate();
  const expired = new Date(handoff.expiresAt).getTime() <= Date.now();
  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter py-xl text-on-background">
      <section className="glass-card w-full max-w-[32rem] rounded-4xl p-lg text-center md:p-xl">
        <h1 className="font-heading text-3xl font-light text-primary">Set up your passkey</h1>
        {expired ? (
          <>
            <p className="mt-md text-sm text-on-surface-variant">Your enrollment window has expired.</p>
            <Button className="mt-xl w-full" onClick={() => void navigate({ to: "/signup-login" })}>Start again</Button>
          </>
        ) : (
          <p className="mt-md text-sm text-on-surface-variant">Your email for {handoff.email} is verified. Passkey setup is the next step.</p>
        )}
      </section>
    </main>
  );
}
