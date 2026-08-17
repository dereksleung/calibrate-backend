import type { SelectedFoodForConfirmation } from "../food-confirmation-state.ts";

export type FoodUnitOption = {
  unit: string;
  baseQuantity: number;
};

export type ScaledFoodNutrition = Pick<
  SelectedFoodForConfirmation,
  | "calories"
  | "totalFatGrams"
  | "saturatedFatGrams"
  | "cholesterolMg"
  | "sodiumMg"
  | "totalCarbohydrateGrams"
  | "fiberGrams"
  | "sugarGrams"
  | "proteinGrams"
>;

function createUnitOption(quantity: number | null, unit: string | null): FoodUnitOption | null {
  if (!Number.isFinite(quantity) || quantity === null || quantity <= 0 || !unit?.trim()) {
    return null;
  }

  return { unit: unit.trim(), baseQuantity: quantity };
}

/** Returns only catalog units that have a matching, positive reference quantity. */
export function getFoodUnitOptions(food: SelectedFoodForConfirmation): FoodUnitOption[] {
  const candidates = [
    createUnitOption(food.quantityServing, food.servingLabel),
    createUnitOption(food.quantityMass, food.massUnit),
    createUnitOption(food.quantityVolume, food.volumeUnit),
  ];
  const seenUnits = new Set<string>();

  return candidates.filter((option): option is FoodUnitOption => {
    if (!option || seenUnits.has(option.unit)) {
      return false;
    }

    seenUnits.add(option.unit);
    return true;
  });
}

function scaleNullableNutrition(value: number | null, scale: number): number | null {
  return value === null ? null : value * scale;
}

/** Scales catalog nutrition from the selected unit's catalog reference quantity. */
export function scaleFoodNutrition(
  food: SelectedFoodForConfirmation,
  chosenQuantity: number,
  chosenUnit: string,
): ScaledFoodNutrition {
  const selectedUnit = getFoodUnitOptions(food).find((option) => option.unit === chosenUnit);
  const scale =
    selectedUnit && Number.isFinite(chosenQuantity) && chosenQuantity >= 0
      ? chosenQuantity / selectedUnit.baseQuantity
      : 0;

  return {
    calories: food.calories * scale,
    totalFatGrams: food.totalFatGrams * scale,
    saturatedFatGrams: scaleNullableNutrition(food.saturatedFatGrams, scale),
    cholesterolMg: scaleNullableNutrition(food.cholesterolMg, scale),
    sodiumMg: scaleNullableNutrition(food.sodiumMg, scale),
    totalCarbohydrateGrams: food.totalCarbohydrateGrams * scale,
    fiberGrams: scaleNullableNutrition(food.fiberGrams, scale),
    sugarGrams: scaleNullableNutrition(food.sugarGrams, scale),
    proteinGrams: food.proteinGrams * scale,
  };
}
