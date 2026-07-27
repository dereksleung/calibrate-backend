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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderRoute(initialEntry: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("signup email verification routing", () => {
  it("requests an email and hands challenge state to the OTP route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const router = renderRoute("/signup-login");

    fireEvent.change(await screen.findByLabelText("Email Address"), {
      target: { value: " Person@Example.COM " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /send verification code/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeTruthy();
    expect(screen.getByText("person@example.com")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/auth/otp");
    expect(router.state.location.searchStr).toBe("");
    expect(router.state.location.state.signupEmailVerification).toMatchObject({
      email: "person@example.com",
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/v1/auth/email-verification");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "person@example.com",
    });
    expect(new Headers(init.headers).has("X-App-Platform")).toBe(false);
  });

  it("redirects a direct OTP visit back to signup", async () => {
    const router = renderRoute("/auth/otp");

    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe("/signup-login");
  });
});
