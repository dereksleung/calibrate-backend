// These are domain layer interfaces, the domain layer and any other outer layer can depend on this

import { MealNameEnumType } from "./food-entry.js";

// Persistence DTOs
export interface FoodEntryPersistenceDto {
  id: string;
  meal: MealNameEnumType;
  name: string;
  brand: string | null;
  iconName: string | null;
  quantity: number;
  quantityUnit: string;
  calories: number;
  totalFatGrams: number;
  totalCarbohydrateGrams: number;
  proteinGrams: number;
  saturatedFatGrams: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
}
