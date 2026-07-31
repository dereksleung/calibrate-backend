import { FoodEntry } from "@domain/entities/food-entry.js";

import type { FoodEntryResponse } from "@calibrate/api-contracts";

export class FoodEntryResponseMapper {
  public static toResponse(foodEntry: FoodEntry): FoodEntryResponse {
    return {
      id: foodEntry.id,
      meal: foodEntry.meal,
      name: foodEntry.name,
      brand: foodEntry.brand,
      calories: foodEntry.calories,
      totalFatGrams: foodEntry.totalFatGrams,
      saturatedFatGrams: foodEntry.saturatedFatGrams,
      cholesterolMg: foodEntry.cholesterolMg,
      sodiumMg: foodEntry.sodiumMg,
      totalCarbohydrateGrams: foodEntry.totalCarbohydrateGrams,
      fiberGrams: foodEntry.fiberGrams,
      sugarGrams: foodEntry.sugarGrams,
      proteinGrams: foodEntry.proteinGrams,
      chosenQuantity: foodEntry.chosenQuantity,
      chosenUnit: foodEntry.chosenUnit,
      quantityServing: foodEntry.quantityServing,
      servingLabel: foodEntry.servingLabel,
      quantityMass: foodEntry.quantityMass,
      massUnit: foodEntry.massUnit,
      quantityVolume: foodEntry.quantityVolume,
      volumeUnit: foodEntry.volumeUnit,
    };
  }
}
