import { MealNameEnum } from "@domain/entities/food-entry.js";
import { buildFoodEntry, buildFoodEntryResponse } from "@factories";
import { FoodEntryResponseMapper } from "@presentation";

describe("FoodEntryResponseMapper", () => {
  it("should map a fully populated FoodEntry to a FoodEntryResponse", () => {
    const foodEntry = buildFoodEntry({
      id: "entry-1",
      meal: MealNameEnum.LUNCH,
      name: "Chicken Breast",
      brand: "Kirkland",
      iconName: "chicken",
      chosenQuantity: 2,
      chosenUnit: "pieces",
      quantityServing: 200,
      servingLabel: "g",
      quantityMass: 200,
      massUnit: "g",
      quantityVolume: null,
      volumeUnit: null,
      calories: 330,
      totalFatGrams: 7,
      saturatedFatGrams: 2,
      cholesterolMg: 130,
      sodiumMg: 100,
      totalCarbohydrateGrams: 0,
      fiberGrams: 0,
      sugarGrams: 0,
      proteinGrams: 62,
    });

    const result = FoodEntryResponseMapper.toResponse(foodEntry);

    expect(result).toEqual(
      buildFoodEntryResponse({
        id: "entry-1",
        meal: MealNameEnum.LUNCH,
        name: "Chicken Breast",
        brand: "Kirkland",
        calories: 330,
        totalFatGrams: 7,
        saturatedFatGrams: 2,
        cholesterolMg: 130,
        sodiumMg: 100,
        totalCarbohydrateGrams: 0,
        fiberGrams: 0,
        sugarGrams: 0,
        proteinGrams: 62,
        chosenQuantity: 2,
        chosenUnit: "pieces",
        quantityServing: 200,
        servingLabel: "g",
        quantityMass: 200,
        massUnit: "g",
        quantityVolume: null,
        volumeUnit: null,
      }),
    );
  });

  it("should map nullable fields as null when not provided", () => {
    const foodEntry = buildFoodEntry({
      id: "entry-2",
      meal: MealNameEnum.DINNER,
      brand: null,
      iconName: null,
      saturatedFatGrams: null,
      cholesterolMg: null,
      sodiumMg: null,
      fiberGrams: null,
      sugarGrams: null,
    });

    const result = FoodEntryResponseMapper.toResponse(foodEntry);

    expect(result).toEqual(
      buildFoodEntryResponse({
        id: "entry-2",
        meal: MealNameEnum.DINNER,
        brand: null,
        saturatedFatGrams: null,
        cholesterolMg: null,
        sodiumMg: null,
        fiberGrams: null,
        sugarGrams: null,
      }),
    );
  });

  it("should not include any extra properties beyond the response interface", () => {
    const foodEntry = buildFoodEntry();

    const result = FoodEntryResponseMapper.toResponse(foodEntry);

    const expectedKeys = [
      "id",
      "meal",
      "name",
      "brand",
      "calories",
      "totalFatGrams",
      "saturatedFatGrams",
      "cholesterolMg",
      "sodiumMg",
      "totalCarbohydrateGrams",
      "fiberGrams",
      "sugarGrams",
      "proteinGrams",
      "chosenQuantity",
      "chosenUnit",
      "quantityServing",
      "servingLabel",
      "quantityMass",
      "massUnit",
      "quantityVolume",
      "volumeUnit",
    ];
    expect(Object.keys(result).sort()).toEqual(expectedKeys.sort());
  });
});
