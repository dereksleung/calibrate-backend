import { PasskeyEnrollmentPage } from "#/pages/auth/PasskeyEnrollmentPage.tsx";
import { parsePasskeyEnrollmentHandoff } from "#/verticals/auth/account-email-verification-handoff";
import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/passkey-enrollment")({
  beforeLoad: ({ location }) => {
    if (!parsePasskeyEnrollmentHandoff(location.state.passkeyEnrollment)) throw redirect({ replace: true, to: "/signup-login" });
  },
  component: PasskeyEnrollmentRoute,
});

function PasskeyEnrollmentRoute() {
  const handoff = parsePasskeyEnrollmentHandoff(useRouterState({ select: (state) => state.location.state.passkeyEnrollment }));
  return handoff ? <PasskeyEnrollmentPage handoff={handoff} /> : null;
}
