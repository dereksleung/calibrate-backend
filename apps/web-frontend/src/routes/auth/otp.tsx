import { OtpPage } from "#/pages/auth/OtpPage.tsx";
import { parseSignupEmailVerificationHandoff } from "#/verticals/auth/signup-email-verification-handoff";
import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/otp")({
  beforeLoad: ({ location }) => {
    const handoff = parseSignupEmailVerificationHandoff(location.state.signupEmailVerification);

    if (!handoff) {
      throw redirect({ replace: true, to: "/signup-login" });
    }
  },
  component: OtpRoute,
});

function OtpRoute() {
  const rawHandoff = useRouterState({
    select: (state) => state.location.state.signupEmailVerification,
  });
  const handoff = parseSignupEmailVerificationHandoff(rawHandoff);

  if (!handoff) return null;

  return <OtpPage handoff={handoff} />;
}
