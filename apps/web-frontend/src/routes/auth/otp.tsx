import { OtpPage } from "#/pages/auth/OtpPage.tsx";
import { parseAccountEmailVerificationHandoff } from "#/verticals/auth/account-email-verification-handoff";
import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/otp")({
  beforeLoad: ({ location }) => {
    const handoff = parseAccountEmailVerificationHandoff(location.state.accountEmailVerification);

    if (!handoff) {
      throw redirect({ replace: true, to: "/signup-login" });
    }
  },
  component: OtpRoute,
});

function OtpRoute() {
  const rawHandoff = useRouterState({
    select: (state) => state.location.state.accountEmailVerification,
  });
  const handoff = parseAccountEmailVerificationHandoff(rawHandoff);

  if (!handoff) return null;

  return <OtpPage handoff={handoff} />;
}
