// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignupLoginPage, SignUpLoginForm } from "./SignupLoginPage";

afterEach(cleanup);

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
    const onSubmitEmail = vi.fn().mockResolvedValue(undefined);
    render(<SignUpLoginForm onSubmitEmail={onSubmitEmail} />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    await waitFor(() => {
      expect(onSubmitEmail).toHaveBeenCalledWith({
        email: "sam@example.com",
      });
    });
  });

  it("shows a safe error when account creation fails", async () => {
    const onSubmitEmail = vi.fn().mockRejectedValue(new Error("Internal server detail"));
    render(<SignUpLoginForm onSubmitEmail={onSubmitEmail} />);

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
