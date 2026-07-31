import { FoodEntryResponse } from "@calibrate/api-contracts";
import { FoodEntry, FoodEntryProps, MealNameEnum } from "@domain/entities/food-entry.js";

export const buildFoodEntry = (overrides: Partial<FoodEntryProps> = {}): FoodEntry =>
  FoodEntry.reconstitute({
    id: overrides.id ?? "1",
    meal: overrides.meal ?? MealNameEnum.BREAKFAST,
    dayLogId: overrides.dayLogId ?? "1",
    name: "Test Food",
    brand: "Test Brand",
    iconName: "test-icon",
    chosenQuantity: 1,
    chosenUnit: "serving",
    quantityServing: 1,
    servingLabel: "serving",
    quantityMass: null,
    massUnit: null,
    quantityVolume: null,
    volumeUnit: null,
    calories: 100,
    totalFatGrams: 10,
    saturatedFatGrams: 10,
    cholesterolMg: 10,
    sodiumMg: 10,
    totalCarbohydrateGrams: 10,
    fiberGrams: 10,
    sugarGrams: 10,
    proteinGrams: 10,
    ...overrides,
  });

export const buildFoodEntryResponse = (overrides: Partial<FoodEntryResponse> = {}): FoodEntryResponse => {
  return {
    id: "1",
    meal: MealNameEnum.BREAKFAST,
    name: "Test Food",
    brand: "Test Brand",
    calories: 100,
    totalFatGrams: 10,
    saturatedFatGrams: 10,
    cholesterolMg: 10,
    sodiumMg: 10,
    totalCarbohydrateGrams: 10,
    fiberGrams: 10,
    sugarGrams: 10,
    proteinGrams: 10,
    chosenQuantity: 1,
    chosenUnit: "serving",
    quantityServing: 1,
    servingLabel: "serving",
    quantityMass: null,
    massUnit: null,
    quantityVolume: null,
    volumeUnit: null,
    ...overrides,
  };
};
