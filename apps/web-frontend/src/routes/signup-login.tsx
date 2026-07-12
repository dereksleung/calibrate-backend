import { createFileRoute } from "@tanstack/react-router";

import { SignupLoginPage } from "#/pages/auth/SignupLoginPage";

export const Route = createFileRoute("/signup-login")({
  component: SignupLoginPage,
});
