import { SignupLoginPage } from "#/pages/auth/SignupLoginPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/signup-login")({
  component: SignupLoginPage,
});
