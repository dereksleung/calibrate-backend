import type { LoginRecoveryHandoff } from "#/verticals/auth/account-email-verification-handoff";

import { Button } from "#/shared/components/base/Button";
import { useNavigate } from "@tanstack/react-router";

export function LoginRecoveryPage({ handoff }: { handoff: LoginRecoveryHandoff }) {
  const navigate = useNavigate();
  return (
    <main className="auth-page-background flex min-h-dvh items-center justify-center px-gutter text-on-background">
      <section className="glass-card w-full max-w-[32rem] rounded-4xl p-xl text-center">
        <h1 className="font-heading text-3xl font-light text-primary">Email verified</h1>
        <p className="mt-md text-on-surface-variant">{handoff.email}</p>
        <p className="mt-md text-sm text-on-surface-variant">
          Passkey login and email recovery options will be available in the next step of this experience.
        </p>
        <Button className="mt-xl" type="button" onClick={() => void navigate({ to: "/signup-login" })}>
          Back to sign up or log in
        </Button>
      </section>
    </main>
  );
}
