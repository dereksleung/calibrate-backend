// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateAccountForm, SignupLoginPage } from "./SignupLoginPage";

afterEach(cleanup);

describe("SignupLoginPage", () => {
  it("opens with Create Account before Sign In", () => {
    expect(typeof SignupLoginPage).toBe("function");
    render(<SignupLoginPage />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Create Account", "Sign In"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Full Name")).toBeTruthy();
    expect(screen.queryByText(/or continue with/i)).toBeNull();
    expect(screen.queryByText(/mindfulness tip/i)).toBeNull();
  });
});

describe("CreateAccountForm", () => {
  it("submits only the credentials supported by the create-user contract", async () => {
    const onCreateAccount = vi.fn().mockResolvedValue(undefined);
    render(<CreateAccountForm onCreateAccount={onCreateAccount} />);

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Sam Rivera" } });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "Strong1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Strong1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    await waitFor(() => {
      expect(onCreateAccount).toHaveBeenCalledWith({
        email: "sam@example.com",
        password: "Strong1!",
      });
    });
  });

  it("shows an accessible error when passwords do not match", async () => {
    render(<CreateAccountForm onCreateAccount={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Sam Rivera" } });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "Strong1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Different1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    expect(await screen.findByText("Passwords must match")).toBeTruthy();
  });

  it("shows a safe error when account creation fails", async () => {
    const onCreateAccount = vi.fn().mockRejectedValue(new Error("Internal server detail"));
    render(<CreateAccountForm onCreateAccount={onCreateAccount} />);

    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Sam Rivera" } });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "Strong1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Strong1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't create your account. Please try again.",
    );
    expect(screen.queryByText("Internal server detail")).toBeNull();
  });
});
