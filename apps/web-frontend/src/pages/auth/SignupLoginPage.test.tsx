// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupLoginPage, SignUpLoginForm } from "./SignupLoginPage";
import { createQueryClient } from "#/shared/api/query-client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { mockMutateAsync, mockNavigate } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@calibrate/api-client", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    useRequestSignupEmailVerification: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
    })),
  };
});

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

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(screen.getByText(/start with a recovery email/i)).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

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

    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't send your verification code. Please try again.",
    );
    expect(screen.queryByText("Internal server detail")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("disables submission while the verification email request is pending", async () => {
    let resolveRequest:
      | ((value: { challengeId: string; expiresInSeconds: number; resendAfterSeconds: number }) => void)
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
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /sending code/i }) as HTMLButtonElement).disabled).toBe(
        true,
      );
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
