import { MealNameEnumType } from "../../domain/entities/food-entry.js";

export interface FoodEntryResponse {
  id: string;
  meal: MealNameEnumType;
  name: string;
  brand: string | null;
  iconName: string | null;
  quantity: number;
  quantityUnit: string;
  calories: number;
  totalFatGrams: number;
  saturatedFatGrams: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  totalCarbohydrateGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  proteinGrams: number;
}
