import type { MealNameEnumType } from "@calibrate/api-contracts";

export type SelectedFoodForConfirmation = {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  quantityServing: number;
  servingLabel: string;
};

export type FoodConfirmationState = {
  food: SelectedFoodForConfirmation;
  preselectedMeal?: MealNameEnumType;
};
