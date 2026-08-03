// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@calibrate/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupLoginPage, SignUpLoginForm } from "./SignupLoginPage";
import { createQueryClient } from "#/shared/api/query-client";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

const {
  mockMutateAsync,
  mockConditionalPasskeyAuthenticationSupported,
  mockNavigate,
  mockRequestPasskeyAuthenticationOptions,
  mockStartPasskeyAuthentication,
  mockVerifyPasskeyAuthentication,
} = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockConditionalPasskeyAuthenticationSupported: vi.fn(async () => false),
  mockNavigate: vi.fn(),
  mockRequestPasskeyAuthenticationOptions: vi.fn(),
  mockStartPasskeyAuthentication: vi.fn(),
  mockVerifyPasskeyAuthentication: vi.fn(),
}));

vi.mock("@calibrate/api-client", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    useRequestSignupEmailVerification: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
    })),
    requestPasskeyAuthenticationOptions: mockRequestPasskeyAuthenticationOptions,
    verifyPasskeyAuthentication: mockVerifyPasskeyAuthentication,
  };
});

vi.mock("#/verticals/auth/browser-passkey-authentication-adapter", () => ({
  cancelPasskeyAuthentication: vi.fn(),
  isBrowserPasskeyAuthenticationSupported: () => true,
  isConditionalPasskeyAuthenticationSupported: mockConditionalPasskeyAuthenticationSupported,
  isPasskeyAuthenticationCancellation: () => false,
  startPasskeyAuthentication: mockStartPasskeyAuthentication,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

describe("SignupLoginPage", () => {
  it("presents the first signup step", () => {
    expect(typeof SignupLoginPage).toBe("function");
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SignupLoginPage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Sign Up or Log In" })).toBeTruthy();
    expect(
      screen.getByText(/To sign up, enter your email and click the Sign Up button./i),
    ).toBeTruthy();
  });

  it("counts down before allowing another passkey request after rate limiting", async () => {
    vi.useFakeTimers();
    mockRequestPasskeyAuthenticationOptions.mockRejectedValue(
      new ApiError({
        status: 429,
        statusText: "Too Many Requests",
        body: { error: "PASSKEY_AUTHENTICATION_RATE_LIMITED" },
        retryAfterSeconds: 2,
      }),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SignupLoginPage />
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /log in with passkey/i }));
    });

    expect(screen.getByText(/try again in 2 seconds/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /try again in 2 seconds/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/try again in 1 second/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /try again in 1 second/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(
      (screen.getByRole("button", { name: /log in with passkey/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("applies the rate-limit countdown when conditional passkey sign-in is limited", async () => {
    vi.useFakeTimers();
    mockConditionalPasskeyAuthenticationSupported.mockResolvedValue(true);
    mockRequestPasskeyAuthenticationOptions.mockRejectedValue(
      new ApiError({
        status: 429,
        statusText: "Too Many Requests",
        body: { error: "PASSKEY_AUTHENTICATION_RATE_LIMITED" },
        retryAfterSeconds: 2,
      }),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <SignupLoginPage />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /try again in 2 seconds/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /try again in 2 seconds/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("SignUpLoginForm", () => {
  it("requests a code then navigates once with non-URL challenge state", async () => {
    mockMutateAsync.mockResolvedValue({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    render(<SignUpLoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith("sam@example.com");
    });
    expect(mockNavigate).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/auth/otp",
      state: expect.any(Function),
    });

    const stateUpdater = mockNavigate.mock.calls[0]?.[0].state;
    expect(stateUpdater({ __TSR_index: 0 })).toEqual({
      __TSR_index: 0,
      signupEmailVerification: {
        email: "sam@example.com",
        challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
        requestedAtEpochMs: expect.any(Number),
      },
    });
  });

  it("shows a safe error without navigating when sending fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Internal server detail"));
    render(<SignUpLoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't send your verification code. Please try again.",
    );
    expect(screen.queryByText("Internal server detail")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("disables submission while the verification email request is pending", async () => {
    let resolveRequest:
      | ((value: {
          challengeId: string;
          expiresInSeconds: number;
          resendAfterSeconds: number;
        }) => void)
      | undefined;
    mockMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<SignUpLoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /sending code/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    resolveRequest?.({
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledOnce();
    });
  });
});
