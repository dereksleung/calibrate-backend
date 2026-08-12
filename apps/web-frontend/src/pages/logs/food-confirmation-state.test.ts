import { describe, expect, it } from "vitest";

import { parseFoodConfirmationState } from "./food-confirmation-state.ts";

const validConfirmation = {
  food: {
    id: "food-123",
    name: "Greek yogurt",
    brand: "Calibrate Kitchen",
    calories: 150,
    totalFatGrams: 4,
    saturatedFatGrams: 2.5,
    cholesterolMg: 15,
    sodiumMg: 65,
    totalCarbohydrateGrams: 8,
    fiberGrams: 0,
    sugarGrams: 6,
    proteinGrams: 18,
    quantityServing: 1,
    servingLabel: "cup",
    quantityMass: 245,
    massUnit: "g",
    quantityVolume: null,
    volumeUnit: null,
  },
  preselectedMeal: "LUNCH",
};

describe("parseFoodConfirmationState", () => {
  it("accepts a complete confirmation state", () => {
    expect(parseFoodConfirmationState(validConfirmation)).toEqual(validConfirmation);
  });

  it("rejects a state without a required food name", () => {
    expect(
      parseFoodConfirmationState({
        ...validConfirmation,
        food: { ...validConfirmation.food, name: undefined },
      }),
    ).toBeNull();
  });

  it("rejects a state with malformed nullable nutrition", () => {
    expect(
      parseFoodConfirmationState({
        ...validConfirmation,
        food: { ...validConfirmation.food, sodiumMg: "65" },
      }),
    ).toBeNull();
  });
});
