import { FoodEntry } from "@models";
import { FoodEntryPersistenceDto } from "../dtos/food-entry-dtos.js";

export class FoodEntryPersistenceMapper {
  static toDomain(dto: FoodEntryPersistenceDto): FoodEntry {
    return FoodEntry.reconstitute({
      id: dto.id,
      meal: dto.meal,
      name: dto.name,
      brand: dto.brand,
      iconName: dto.iconName,
      quantity: dto.quantity,
      quantityUnit: dto.quantityUnit,
      calories: dto.calories,
      totalFatGrams: dto.totalFatGrams,
      saturatedFatGrams: dto.saturatedFatGrams,
      cholesterolMg: dto.cholesterolMg,
      sodiumMg: dto.sodiumMg,
      totalCarbohydrateGrams: dto.totalCarbohydrateGrams,
      fiberGrams: dto.fiberGrams,
      sugarGrams: dto.sugarGrams,
      proteinGrams: dto.proteinGrams,
    });
  }
}
