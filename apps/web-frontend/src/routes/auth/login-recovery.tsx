import { LoginRecoveryPage } from "#/pages/auth/LoginRecoveryPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/login-recovery")({
  component: LoginRecoveryRoute,
});

function LoginRecoveryRoute() {
  return <LoginRecoveryPage />;
}
