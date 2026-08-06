import type { FoodCatalogInput } from "@application/ports/food-catalog-writer.js";

interface FdcNutrient { nutrientId?: number; value?: number; }
export interface FdcSearchFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients?: FdcNutrient[];
}

function nutrientValue(nutrients: FdcNutrient[] | undefined, nutrientId: number): number | null {
  const value = nutrients?.find((nutrient) => nutrient.nutrientId === nutrientId)?.value;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Normalizes UPC/EAN/GTIN to 14 digits and rejects invalid check digits. */
export function normalizeVerifiedGtin(value: string | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const normalized = digits.padStart(14, "0");
  const checksum = normalized.slice(0, -1).split("").reverse().reduce((sum, digit, index) =>
    sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (checksum % 10)) % 10 === Number(normalized[normalized.length - 1]) ? normalized : null;
}

export function mapFdcSearchFood(food: FdcSearchFood): FoodCatalogInput | null {
  if (!Number.isInteger(food.fdcId) || food.fdcId! <= 0 || !food.description?.trim()) return null;
  const calories = nutrientValue(food.foodNutrients, 1008);
  const proteinGrams = nutrientValue(food.foodNutrients, 1003);
  const totalCarbohydrateGrams = nutrientValue(food.foodNutrients, 1005);
  const totalFatGrams = nutrientValue(food.foodNutrients, 1004);
  if (calories === null || proteinGrams === null || totalCarbohydrateGrams === null || totalFatGrams === null) return null;
  return {
    name: food.description.trim(), brand: food.brandOwner?.trim() || null, quantityServing: 1, servingLabel: "serving",
    quantityMass: null, massUnit: null, quantityVolume: null, volumeUnit: null, calories, totalFatGrams,
    saturatedFatGrams: nutrientValue(food.foodNutrients, 1258), cholesterolMg: nutrientValue(food.foodNutrients, 1253),
    sodiumMg: nutrientValue(food.foodNutrients, 1093), totalCarbohydrateGrams, fiberGrams: nutrientValue(food.foodNutrients, 1079),
    sugarGrams: nutrientValue(food.foodNutrients, 2000), proteinGrams, source: "fdc", sourceFoodId: String(food.fdcId),
    normalizedGtin: normalizeVerifiedGtin(food.gtinUpc), verificationState: "verified",
  };
}
