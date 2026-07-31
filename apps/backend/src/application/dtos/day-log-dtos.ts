import { MealNameEnumType } from "@domain/entities/food-entry.js";

// Repository DTOs
export interface GetDayLogByDateAndUserDto {
  userId: string;
  date: string;
}

export interface FindOrCreateDayLogByDateAndUserIdRepositoryDto {
  date: string;
  userId: string;
}
// Service layer DTOs for client inputs
export interface GetDayLogRequestDto {
  userId: string;
  date: string;
}

export interface AddFoodEntryRequestDto {
  userId: string;
  date: string;
  foodEntry: {
    meal: MealNameEnumType;
    name: string;
    brand: string | null;
    iconName: string | null;
    chosenQuantity: number;
    chosenUnit: string;
    quantityServing: number;
    servingLabel: string;
    quantityMass: number | null;
    massUnit: string | null;
    quantityVolume: number | null;
    volumeUnit: string | null;
    calories: number;
    totalFatGrams: number;
    saturatedFatGrams: number | null;
    cholesterolMg: number | null;
    sodiumMg: number | null;
    totalCarbohydrateGrams: number;
    fiberGrams: number | null;
    sugarGrams: number | null;
    proteinGrams: number;
  };
}

// Cross-service DTOs for client inputs, if any
