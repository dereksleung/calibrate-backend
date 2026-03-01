import { FoodEntry } from "@domain";
import { FoodEntryResponse } from "../http/food-entry-responses.js";

export class FoodEntryResponseMapper {
  public static toResponse(foodEntry: FoodEntry): FoodEntryResponse {
    return {
      id: foodEntry.id,
      meal: foodEntry.meal,
      name: foodEntry.name,
      brand: foodEntry.brand,
      iconName: foodEntry.iconName,
      quantity: foodEntry.quantity,
      quantityUnit: foodEntry.quantityUnit,
      calories: foodEntry.calories,
      totalFatGrams: foodEntry.totalFatGrams,
      saturatedFatGrams: foodEntry.saturatedFatGrams,
      cholesterolMg: foodEntry.cholesterolMg,
      sodiumMg: foodEntry.sodiumMg,
      totalCarbohydrateGrams: foodEntry.totalCarbohydrateGrams,
      fiberGrams: foodEntry.fiberGrams,
      sugarGrams: foodEntry.sugarGrams,
      proteinGrams: foodEntry.proteinGrams,
    };
  }
}
