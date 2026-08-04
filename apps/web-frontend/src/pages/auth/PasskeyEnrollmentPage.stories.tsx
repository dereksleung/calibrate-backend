import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";

import { createQueryClient } from "#/shared/api/query-client";
import type { PasskeyEnrollmentHandoff } from "#/verticals/auth/account-email-verification-handoff";

import "../../styles.css";
import { PasskeyEnrollmentPage } from "./PasskeyEnrollmentPage";

const handoff = {
  email: "person@example.com",
  next: "passkey-registration",
  expiresAt: "2030-01-01T00:05:00.000Z",
} satisfies PasskeyEnrollmentHandoff;

type PasskeyEnrollmentPageProps = ComponentProps<typeof PasskeyEnrollmentPage>;

function PasskeyEnrollmentPageStory(props: PasskeyEnrollmentPageProps) {
  const rootRoute = createRootRoute({
    component: () => <PasskeyEnrollmentPage {...props} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return (
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const meta = {
  title: "Pages/Passkey Enrollment",
  component: PasskeyEnrollmentPage,
  parameters: { layout: "fullscreen" },
  args: { handoff },
  render: (args) => <PasskeyEnrollmentPageStory {...args} />,
} satisfies Meta<typeof PasskeyEnrollmentPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: { initialUiState: { kind: "ready" } },
};

export const Pending: Story = {
  args: { initialUiState: { kind: "pending" } },
};

export const Unsupported: Story = {
  args: { initialUiState: { kind: "unsupported" } },
};

export const Expired: Story = {
  args: { initialUiState: { kind: "expired" } },
};

export const Cancelled: Story = {
  args: { initialUiState: { kind: "cancelled" } },
};

export const Ambiguous: Story = {
  args: { initialUiState: { kind: "ambiguous" } },
};

export const EnrollmentAuthorizationRequired: Story = {
  args: { initialUiState: { kind: "ENROLLMENT_AUTHORIZATION_REQUIRED" } },
};

export const OriginNotAllowed: Story = {
  args: { initialUiState: { kind: "ORIGIN_NOT_ALLOWED" } },
};

export const VerificationFailed: Story = {
  args: { initialUiState: { kind: "PASSKEY_REGISTRATION_FAILED" } },
};

export const StateConflict: Story = {
  args: { initialUiState: { kind: "PASSKEY_REGISTRATION_STATE_CONFLICT" } },
};

export const Unavailable: Story = {
  args: { initialUiState: { kind: "PASSKEY_REGISTRATION_UNAVAILABLE" } },
};

export const RateLimited: Story = {
  args: {
    initialUiState: {
      kind: "PASSKEY_REGISTRATION_RATE_LIMITED",
      retryAfterSeconds: 60,
    },
  },
};
