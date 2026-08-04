// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OtpPage } from "./OtpPage";

const { mockMutateAsync, mockVerifyMutateAsync, mockNavigate } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockVerifyMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@calibrate/api-client", async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return {
    ...original,
    useRequestAccountEmailVerification: vi.fn(() => ({
      isPending: false,
      mutateAsync: mockMutateAsync,
    })),
    useVerifyAccountEmailVerification: vi.fn(() => ({
      isPending: false,
      mutateAsync: mockVerifyMutateAsync,
    })),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return {
    ...original,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

vi.mock("#/verticals/auth/components/InputOtp.tsx", () => ({
  InputOTP: ({ children, onChange, value }: { children: ReactNode; onChange: (value: string) => void; value: string }) => (
    <div>
      <input aria-label="Verification code" value={value} onChange={(event) => onChange(event.target.value)} />
      {children}
    </div>
  ),
  InputOTPGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InputOTPSlot: ({ index }: { index: number }) => <span data-slot-index={index} />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const handoff = {
  email: "person@example.com",
  challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
  expiresInSeconds: 600,
  resendAfterSeconds: 0,
  requestedAtEpochMs: Date.now(),
};

describe("OtpPage", () => {
  it("shows server handoff data and validates the verification code", () => {
    render(<OtpPage handoff={handoff} />);

    expect(screen.getByText("person@example.com")).toBeTruthy();
    expect(screen.getByText(/expires in 10 minutes/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));
    expect(screen.getByRole("alert").textContent).toContain("Enter the 6-digit code");
  });

  it("submits the six-digit code and navigates with metadata only", async () => {
    mockVerifyMutateAsync.mockResolvedValue({
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    render(<OtpPage handoff={handoff} />);

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(mockVerifyMutateAsync).toHaveBeenCalledWith({ challengeId: handoff.challengeId, code: "012345" });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/auth/passkey-enrollment",
      state: expect.any(Function),
    });
  });

  it("counts down from the server-provided resend timing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    render(
      <OtpPage
        handoff={{
          ...handoff,
          resendAfterSeconds: 60,
          requestedAtEpochMs: Date.now(),
        }}
      />,
    );

    expect(screen.getByText("60s")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("59s")).toBeTruthy();
  });

  it("replaces challenge state after a successful resend", async () => {
    mockMutateAsync.mockResolvedValue({
      challengeId: "7534698d-ab5b-455d-8739-3a41ed1458cc",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    render(<OtpPage handoff={handoff} />);

    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith("person@example.com");
    });
    expect(mockNavigate).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith({
      replace: true,
      state: expect.any(Function),
      to: "/auth/otp",
    });

    const stateUpdater = mockNavigate.mock.calls[0]?.[0].state;
    expect(stateUpdater({ __TSR_index: 1 })).toEqual({
      __TSR_index: 1,
      accountEmailVerification: {
        email: "person@example.com",
        challengeId: "7534698d-ab5b-455d-8739-3a41ed1458cc",
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
        requestedAtEpochMs: expect.any(Number),
      },
    });
  });

  it("keeps the current challenge and shows an accessible error when resend fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("provider detail"));
    render(<OtpPage handoff={handoff} />);

    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't resend your verification code. Please try again.",
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
