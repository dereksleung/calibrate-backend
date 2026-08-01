// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "#/routeTree.gen.ts";
import { createQueryClient } from "#/shared/api/query-client.ts";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

beforeEach(() => {
  window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PublicKeyCredential", {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderRoute(initialEntry: string, state?: Record<string, unknown>) {
  const history = createMemoryHistory({
    initialEntries: ["/"],
  });
  const router = createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  history.replace(initialEntry, state);

  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("passkey enrollment routing", () => {
  it("redirects a direct visit back to signup when handoff state is missing", async () => {
    const router = renderRoute("/auth/passkey-enrollment");

    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/signup-login");
  });

  it("shows the enrollment page when OTP verification hands off enrollment metadata", async () => {
    renderRoute("/auth/passkey-enrollment", {
      passkeyEnrollment: {
        email: "person@example.com",
        next: "passkey-registration",
        expiresAt: "2030-01-01T00:05:00.000Z",
      },
    });

    expect(await screen.findByRole("heading", { name: "Set up your passkey" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /create passkey/i })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /keep me signed in/i })).toBeTruthy();
  });
});

describe("passkey signup vertical flow", () => {
  it("hands off from email verification to the enrollment page without exposing secrets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, _init) => {
      const url = String(input);
      if (url.endsWith("/auth/email-verification")) {
        return new Response(
          JSON.stringify({
            challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
            expiresInSeconds: 600,
            resendAfterSeconds: 60,
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/email-verification/verify")) {
        return new Response(
          JSON.stringify({
            next: "passkey-registration",
            expiresAt: "2030-01-01T00:05:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const router = renderRoute("/signup-login");
    fireEvent.change(await screen.findByLabelText("Email Address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
    await screen.findByRole("heading", { name: "Check your email" });

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    expect(await screen.findByRole("heading", { name: "Set up your passkey" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/auth/passkey-enrollment");
    expect(router.state.location.state.passkeyEnrollment).toMatchObject({
      email: "person@example.com",
      next: "passkey-registration",
    });
    expect(JSON.stringify(router.state.location.state)).not.toContain("token");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });
});
