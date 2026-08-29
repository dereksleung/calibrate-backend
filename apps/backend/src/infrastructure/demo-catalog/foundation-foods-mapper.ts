import type { FoodCatalogInput } from "@application/ports/food-catalog-writer.js";

export const FOUNDATION_FOODS_CATALOG_SOURCE = "fdc";
export const REFERENCE_FALLBACK_GRAMS = 100;
const NAME_MAX_LENGTH = 160;
const SERVING_LABEL_MAX_LENGTH = 80;

const VOLUME_MEASURES = new Set([
  "cup",
  "tablespoon",
  "teaspoon",
  "milliliter",
  "millilitre",
  "liter",
  "litre",
  "fluid ounce",
  "fl oz",
  "pint",
  "quart",
  "gallon",
  "dessertspoon",
]);

const MASS_MEASURES = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "kilogram",
  "kilograms",
  "mg",
  "milligram",
  "milligrams",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "pound",
  "pounds",
]);

const EXCLUDED_MEASURES = new Set(["", "undetermined", "racc"]);

const ENERGY_KCAL_IDS = [1008, 2048, 2047];
const PROTEIN_IDS = [1003];
const FAT_IDS = [1004];
const CARBOHYDRATE_IDS = [1005];
const SATURATED_FAT_IDS = [1258];
const CHOLESTEROL_IDS = [1253];
const SODIUM_IDS = [1093];
const FIBER_IDS = [1079];
const SUGAR_IDS = [2000, 1063];

export interface FoundationFoodMappingError {
  sourceFoodId: string;
  description: string;
  error: string;
}

export interface UnreportedNutrient {
  sourceFoodId: string;
  description: string;
  nutrient: string;
}

export interface FoundationFoodMappingSuccess {
  record: FoodCatalogInput;
  unreportedNutrients: UnreportedNutrient[];
}

export type FoundationFoodMappingResult =
  | { ok: true; value: FoundationFoodMappingSuccess }
  | { ok: false; error: FoundationFoodMappingError };

export interface FoundationFoodsMappingSummary {
  totalRecordCount: number;
  importableRecordCount: number;
  mappingErrorCount: number;
  unreportedNutrientCount: number;
  records: FoodCatalogInput[];
  mappingErrors: FoundationFoodMappingError[];
  unreportedNutrients: UnreportedNutrient[];
}

interface NutrientReading {
  value: number;
  reported: boolean;
}

type MeasureKind = "named" | "volume" | "mass";

interface UsablePortion {
  id: number | null;
  sequenceNumber: number;
  amount: number;
  gramWeight: number;
  measureName: string;
  kind: MeasureKind;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  const number = readFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function nutrientId(entry: Record<string, unknown>): number | null {
  const nested = isRecord(entry.nutrient) ? readFiniteNumber(entry.nutrient.id) : null;
  return nested ?? readFiniteNumber(entry.nutrientId);
}

function nutrientAmount(entry: Record<string, unknown>): number | null {
  const amount = readFiniteNumber(entry.amount);
  return amount ?? readFiniteNumber(entry.value);
}

function readNutrient(foodNutrients: unknown, ids: readonly number[]): NutrientReading {
  if (!Array.isArray(foodNutrients)) return { value: 0, reported: false };
  for (const id of ids) {
    for (const entry of foodNutrients) {
      if (!isRecord(entry) || nutrientId(entry) !== id) continue;
      const amount = nutrientAmount(entry);
      if (amount === null || amount < 0) continue;
      return { value: amount, reported: true };
    }
  }
  return { value: 0, reported: false };
}

function measureKind(measureName: string): MeasureKind | null {
  const normalized = measureName.trim().toLowerCase();
  if (EXCLUDED_MEASURES.has(normalized)) return null;
  if (VOLUME_MEASURES.has(normalized)) return "volume";
  if (MASS_MEASURES.has(normalized)) return "mass";
  return "named";
}

function readUsablePortion(value: unknown): UsablePortion | null {
  if (!isRecord(value)) return null;
  const amount = readPositiveNumber(value.amount) ?? readPositiveNumber(value.value);
  const gramWeight = readPositiveNumber(value.gramWeight);
  const measureName =
    isRecord(value.measureUnit) && typeof value.measureUnit.name === "string"
      ? value.measureUnit.name.trim()
      : "";
  const kind = measureKind(measureName);
  if (amount === null || gramWeight === null || kind === null) return null;
  if (kind !== "mass" && measureName.length > SERVING_LABEL_MAX_LENGTH) return null;
  return {
    id: readFiniteNumber(value.id),
    sequenceNumber: readFiniteNumber(value.sequenceNumber) ?? Number.POSITIVE_INFINITY,
    amount,
    gramWeight,
    measureName,
    kind,
  };
}

function comparePortions(left: UsablePortion, right: UsablePortion): number {
  if (left.sequenceNumber !== right.sequenceNumber) return left.sequenceNumber - right.sequenceNumber;
  if (left.id !== null && right.id !== null && left.id !== right.id) return left.id - right.id;
  return left.measureName.localeCompare(right.measureName);
}

function firstOfKind(portions: UsablePortion[], kind: MeasureKind): UsablePortion | undefined {
  return [...portions.filter((portion) => portion.kind === kind)].sort(comparePortions)[0];
}

function equivalentVolume(reference: UsablePortion, portions: UsablePortion[]): UsablePortion | undefined {
  const referenceGrams = round2(reference.gramWeight);
  return [
    ...portions.filter(
      (portion) => portion.kind === "volume" && round2(portion.gramWeight) === referenceGrams,
    ),
  ].sort(comparePortions)[0];
}

function scalePer100g(value: number, gramWeight: number): number {
  return round2(value * (gramWeight / REFERENCE_FALLBACK_GRAMS));
}

function pushUnreported(
  unreported: UnreportedNutrient[],
  reading: NutrientReading,
  identity: { sourceFoodId: string; description: string },
  nutrient: string,
): number {
  if (!reading.reported) {
    unreported.push({ ...identity, nutrient });
  }
  return reading.value;
}

export function mapFoundationFood(food: unknown, sourceIndex = 0): FoundationFoodMappingResult {
  if (!isRecord(food)) {
    return {
      ok: false,
      error: {
        sourceFoodId: "",
        description: "",
        error: `Source record at index ${sourceIndex} is missing or not an object`,
      },
    };
  }

  const fdcId = readFiniteNumber(food.fdcId);
  const description = typeof food.description === "string" ? food.description.trim() : "";
  if (fdcId === null || !Number.isInteger(fdcId) || fdcId <= 0) {
    return {
      ok: false,
      error: {
        sourceFoodId: fdcId === null ? "" : String(fdcId),
        description,
        error: "Source record is missing a positive USDA food identity",
      },
    };
  }
  if (!description) {
    return {
      ok: false,
      error: {
        sourceFoodId: String(fdcId),
        description: "",
        error: "Source record is missing a food description",
      },
    };
  }
  if (description.length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: {
        sourceFoodId: String(fdcId),
        description,
        error: `Food description exceeds ${NAME_MAX_LENGTH} characters`,
      },
    };
  }

  const identity = { sourceFoodId: String(fdcId), description };
  const unreportedNutrients: UnreportedNutrient[] = [];
  const caloriesPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, ENERGY_KCAL_IDS),
    identity,
    "Energy",
  );
  const proteinPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, PROTEIN_IDS),
    identity,
    "Protein",
  );
  const fatPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, FAT_IDS),
    identity,
    "Total fat",
  );
  const carbohydratePer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, CARBOHYDRATE_IDS),
    identity,
    "Carbohydrate",
  );
  const saturatedFatPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, SATURATED_FAT_IDS),
    identity,
    "Saturated fat",
  );
  const cholesterolPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, CHOLESTEROL_IDS),
    identity,
    "Cholesterol",
  );
  const sodiumPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, SODIUM_IDS),
    identity,
    "Sodium",
  );
  const fiberPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, FIBER_IDS),
    identity,
    "Fiber",
  );
  const sugarPer100g = pushUnreported(
    unreportedNutrients,
    readNutrient(food.foodNutrients, SUGAR_IDS),
    identity,
    "Sugars",
  );

  const usablePortions = (Array.isArray(food.foodPortions) ? food.foodPortions : [])
    .map(readUsablePortion)
    .filter((portion): portion is UsablePortion => portion !== null)
    .sort(comparePortions);

  const namedPortion = firstOfKind(usablePortions, "named");
  const volumePortion = firstOfKind(usablePortions, "volume");
  const reference = namedPortion ?? volumePortion;

  const quantityMass = round2(reference?.gramWeight ?? REFERENCE_FALLBACK_GRAMS);
  const retainedVolume = reference
    ? reference.kind === "volume"
      ? reference
      : equivalentVolume(reference, usablePortions)
    : undefined;

  const record: FoodCatalogInput = {
    name: description,
    brand: null,
    quantityServing: round2(reference?.amount ?? REFERENCE_FALLBACK_GRAMS),
    servingLabel: reference?.kind === "named" || reference?.kind === "volume" ? reference.measureName : "g",
    quantityMass,
    massUnit: "g",
    quantityVolume: retainedVolume ? round2(retainedVolume.amount) : null,
    volumeUnit: retainedVolume ? retainedVolume.measureName : null,
    calories: scalePer100g(caloriesPer100g, quantityMass),
    totalFatGrams: scalePer100g(fatPer100g, quantityMass),
    saturatedFatGrams: scalePer100g(saturatedFatPer100g, quantityMass),
    cholesterolMg: scalePer100g(cholesterolPer100g, quantityMass),
    sodiumMg: scalePer100g(sodiumPer100g, quantityMass),
    totalCarbohydrateGrams: scalePer100g(carbohydratePer100g, quantityMass),
    fiberGrams: scalePer100g(fiberPer100g, quantityMass),
    sugarGrams: scalePer100g(sugarPer100g, quantityMass),
    proteinGrams: scalePer100g(proteinPer100g, quantityMass),
    source: FOUNDATION_FOODS_CATALOG_SOURCE,
    sourceFoodId: String(fdcId),
    normalizedGtin: null,
    verificationState: "verified",
  };

  return { ok: true, value: { record, unreportedNutrients } };
}

export function mapFoundationFoods(foods: unknown[]): FoundationFoodsMappingSummary {
  const records: FoodCatalogInput[] = [];
  const mappingErrors: FoundationFoodMappingError[] = [];
  const unreportedNutrients: UnreportedNutrient[] = [];

  foods.forEach((food, sourceIndex) => {
    const mapped = mapFoundationFood(food, sourceIndex);
    if (!mapped.ok) {
      mappingErrors.push(mapped.error);
      return;
    }
    records.push(mapped.value.record);
    unreportedNutrients.push(...mapped.value.unreportedNutrients);
  });

  mappingErrors.sort((left, right) => {
    const byId = left.sourceFoodId.localeCompare(right.sourceFoodId);
    return byId !== 0 ? byId : left.description.localeCompare(right.description);
  });
  unreportedNutrients.sort((left, right) => {
    const byId = left.sourceFoodId.localeCompare(right.sourceFoodId);
    if (byId !== 0) return byId;
    const byName = left.description.localeCompare(right.description);
    return byName !== 0 ? byName : left.nutrient.localeCompare(right.nutrient);
  });

  return {
    totalRecordCount: foods.length,
    importableRecordCount: records.length,
    mappingErrorCount: mappingErrors.length,
    unreportedNutrientCount: unreportedNutrients.length,
    records,
    mappingErrors,
    unreportedNutrients,
  };
}
