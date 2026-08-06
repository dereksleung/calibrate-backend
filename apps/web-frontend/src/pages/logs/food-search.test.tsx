// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FoodSearchPage, mockRecentFoods } from "./components/FoodSearchPage.tsx";

describe("FoodSearchPage", () => {
  it("renders mock recent foods in tappable glass cards", () => {
    const onSelectFood = vi.fn();

    render(<FoodSearchPage recentFoods={mockRecentFoods} onSelectFood={onSelectFood} />);

    expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recently logged" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /select Zero Sugar Oat/i })).toBeTruthy();
    expect(screen.getByText("40 cal · 1 cup · Earth's Own")).toBeTruthy();
    expect(screen.getByText("376 cal · 1 meal")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /select Zero Sugar Oat/i }));

    expect(onSelectFood).toHaveBeenCalledWith(expect.objectContaining({
      food: expect.objectContaining({ name: "Zero Sugar Oat" }),
    }));
  });

  it("renders glass-card skeletons while recent foods load", () => {
    render(<FoodSearchPage state="loading" />);

    expect(screen.getByLabelText("Loading recently logged foods")).toBeTruthy();
  });

  it("renders a simple empty result message", () => {
    render(<FoodSearchPage state="empty" />);

    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("renders a warning banner when recent foods cannot load", () => {
    render(<FoodSearchPage state="error" />);

    expect(screen.getByRole("alert").textContent).toContain("Could not search.");
  });
});
