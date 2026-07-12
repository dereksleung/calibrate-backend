// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WarningBanner } from "./WarningBanner";

afterEach(cleanup);

describe("WarningBanner", () => {
  it("announces the Stitch authentication error by default", () => {
    render(<WarningBanner />);

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain("Invalid email or password. Please try again.");
    expect(banner.className).toContain("bg-error-container");
  });
});
