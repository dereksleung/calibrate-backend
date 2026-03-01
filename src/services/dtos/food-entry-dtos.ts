import { MealNameEnumType } from "../../models/domain/food-entry.js";

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
