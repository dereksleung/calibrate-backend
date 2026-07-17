// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupLoginPage, SignUpLoginForm } from "./SignupLoginPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { mockMutateAsync, mockNavigate } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@calibrate/api-client", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    useRequestEmailOtp: vi.fn(() => ({
      mutateAsync: mockMutateAsync,
    })),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

describe("SignupLoginPage", () => {
  it("opens on the Unified Sign Up / In tab", () => {
    expect(typeof SignupLoginPage).toBe("function");
    render(<SignupLoginPage />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Unified Sign Up / In"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
  });
});

describe("SignUpLoginForm", () => {
  it("submits only the credentials supported by the create-user contract", async () => {
    render(<SignUpLoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith("sam@example.com");
    });
  });

  it("shows a safe error when account creation fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Internal server detail"));
    render(<SignUpLoginForm />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't create your account. Please try again.",
    );
    expect(screen.queryByText("Internal server detail")).toBeNull();
  });
});
