// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmFood } from "./ConfirmFood.tsx";

afterEach(cleanup);

const confirmation = {
  food: {
    id: "tofu", name: "Organic Extra Firm Tofu", brand: "Calibrate Kitchen", calories: 222,
    totalFatGrams: 12.7, saturatedFatGrams: 1.8, cholesterolMg: 0, sodiumMg: 100,
    totalCarbohydrateGrams: 3.2, fiberGrams: 1, sugarGrams: 0, proteinGrams: 23.9,
    quantityServing: 1, servingLabel: "serving", quantityMass: null, massUnit: null, quantityVolume: null, volumeUnit: null,
  },
  preselectedMeal: "LUNCH" as const,
};

describe("ConfirmFood", () => {
  it("lets a person adjust quantity, unit, and meal without editing calories", () => {
    const onSave = vi.fn();
    render(<ConfirmFood confirmation={confirmation} onCancel={vi.fn()} onSave={onSave} />);

    expect(screen.getByText("222 cal")).toBeTruthy();
    expect(screen.queryByLabelText(/calories/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Lunch" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Dinner" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ chosenQuantity: 2, chosenUnit: "serving", meal: "DINNER", calories: 222 }));
  });

  it("keeps an invalid quantity on the page and explains how to fix it", () => {
    const onSave = vi.fn();
    render(<ConfirmFood confirmation={confirmation} onCancel={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("alert").textContent).toContain("greater than 0");
    expect(onSave).not.toHaveBeenCalled();
  });
});
