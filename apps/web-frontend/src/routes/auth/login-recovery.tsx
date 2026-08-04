import { LoginRecoveryPage } from "#/pages/auth/LoginRecoveryPage";
import { parseLoginRecoveryHandoff } from "#/verticals/auth/account-email-verification-handoff";
import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/login-recovery")({
  beforeLoad: ({ location }) => {
    if (!parseLoginRecoveryHandoff(location.state.loginRecovery)) throw redirect({ replace: true, to: "/signup-login" });
  },
  component: LoginRecoveryRoute,
});

function LoginRecoveryRoute() {
  const rawHandoff = useRouterState({ select: (state) => state.location.state.loginRecovery });
  const handoff = parseLoginRecoveryHandoff(rawHandoff);
  return handoff ? <LoginRecoveryPage handoff={handoff} /> : null;
}
