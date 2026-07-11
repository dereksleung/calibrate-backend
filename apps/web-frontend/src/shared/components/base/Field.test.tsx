// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Field, FieldInputWrapper, FieldError, FieldIcon, FieldInput, FieldLabel } from "./Field";

afterEach(cleanup);

describe("Field", () => {
  it("renders the Stitch-inspired pill field treatment", () => {
    render(
      <Field>
        <FieldLabel htmlFor="email">Email Address</FieldLabel>
        <FieldInputWrapper>
          <FieldInput id="email" placeholder="example@zen.com" type="email" />
          <FieldIcon>
            <svg aria-hidden="true" />
          </FieldIcon>
        </FieldInputWrapper>
      </Field>,
    );

    const label = screen.getByText("Email Address");
    const input = screen.getByPlaceholderText("example@zen.com");

    expect(label.className).toContain("ml-md");
    expect(label.className).toContain("text-on-surface-variant");
    expect(input.className).toContain("rounded-full");
    expect(input.className).toContain("bg-white/50");
    expect(input.className).toContain("placeholder:text-outline-variant");
    expect(input.className).toContain("focus-visible:ring-primary/20");
  });


  it("deduplicates errors and can render them as a banner", () => {
    render(
      <FieldError
        errors={[
          { message: "Invalid email or password. Please try again." },
          { message: "Invalid email or password. Please try again." },
        ]}
      />,
    );

    const error = screen.getByRole("alert");

    expect(error.textContent).toBe("Invalid email or password. Please try again.");
  });
});
