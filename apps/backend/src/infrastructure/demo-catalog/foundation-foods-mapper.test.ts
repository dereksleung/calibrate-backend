import { describe, expect, it } from "vitest";

import { mapFoundationFood, mapFoundationFoods } from "./foundation-foods-mapper.js";

function nutrient(id: number, amount: number | undefined) {
  return { nutrient: { id }, ...(amount === undefined ? {} : { amount }) };
}

function portion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    amount: 1,
    gramWeight: 50,
    sequenceNumber: 1,
    measureUnit: { name: "piece" },
    ...overrides,
  };
}

function food(overrides: Record<string, unknown> = {}) {
  return {
    fdcId: 321358,
    description: "Hummus, commercial",
    foodNutrients: [
      nutrient(1008, 166),
      nutrient(1003, 8),
      nutrient(1004, 10),
      nutrient(1005, 14),
      nutrient(1258, 1.5),
      nutrient(1253, 0),
      nutrient(1093, 240),
      nutrient(1079, 6),
      nutrient(2000, 0.4),
    ],
    foodPortions: [portion()],
    ...overrides,
  };
}

function mappedRecord(value: unknown) {
  const mapped = mapFoundationFood(value);
  expect(mapped.ok).toBe(true);
  if (!mapped.ok) throw new Error("expected a mapped food");
  return mapped.value;
}

describe("mapFoundationFood", () => {
  it("keeps a named non-volume measure with mass and an equivalent volume on the same nutrition basis", () => {
    const { record } = mappedRecord(
      food({
        foodPortions: [
          portion({ id: 2, amount: 1, gramWeight: 50, sequenceNumber: 2, measureUnit: { name: "cup" } }),
          portion({ id: 1, amount: 2, gramWeight: 50, sequenceNumber: 1, measureUnit: { name: "piece" } }),
        ],
      }),
    );

    expect(record).toMatchObject({
      name: "Hummus, commercial",
      brand: null,
      quantityServing: 2,
      servingLabel: "piece",
      quantityMass: 50,
      massUnit: "g",
      quantityVolume: 1,
      volumeUnit: "cup",
      calories: 83,
      proteinGrams: 4,
      totalFatGrams: 5,
      totalCarbohydrateGrams: 7,
      source: "fdc",
      sourceFoodId: "321358",
      normalizedGtin: null,
      verificationState: "verified",
    });
  });

  it("normalizes a volume measure that describes a different food amount", () => {
    const { record } = mappedRecord(
      food({
        fdcId: 321360,
        description: "Tomatoes, grape, raw",
        foodPortions: [
          portion({ id: 118808, amount: 5, gramWeight: 49.7, measureUnit: { name: "tomatoes" } }),
          portion({ id: 118809, sequenceNumber: 2, amount: 1, gramWeight: 152, measureUnit: { name: "cup" } }),
        ],
      }),
    );

    expect(record).toMatchObject({
      servingLabel: "tomatoes",
      quantityServing: 5,
      quantityMass: 49.7,
      quantityVolume: 0.33,
      volumeUnit: "cup",
      calories: 82.5,
    });
  });

  it("uses a verified volume measure when no named non-volume measure is available", () => {
    const { record } = mappedRecord(
      food({
        foodPortions: [
          portion({ amount: 2, gramWeight: 33.9, measureUnit: { name: "tablespoon" } }),
          portion({ amount: 1, gramWeight: 30, measureUnit: { name: "RACC" } }),
        ],
      }),
    );

    expect(record).toMatchObject({
      quantityServing: 2,
      servingLabel: "tablespoon",
      quantityMass: 33.9,
      massUnit: "g",
      quantityVolume: 2,
      volumeUnit: "tablespoon",
      calories: 56.27,
    });
  });

  it("falls back to a 100 g Reference serving when no usable USDA portion exists", () => {
    const { record } = mappedRecord(food({ foodPortions: [] }));

    expect(record).toMatchObject({
      quantityServing: 100,
      servingLabel: "g",
      quantityMass: 100,
      massUnit: "g",
      quantityVolume: null,
      volumeUnit: null,
      calories: 166,
      proteinGrams: 8,
    });
  });

  it("ignores unsupported portions instead of inferring units from modifiers or descriptions", () => {
    const { record } = mappedRecord(
      food({
        foodPortions: [
          {
            amount: 1,
            gramWeight: 240,
            measureUnit: { name: "undetermined" },
            modifier: "cup, diced",
            portionDescription: "1 cup, diced",
          },
          { amount: 0, gramWeight: 50, measureUnit: { name: "piece" } },
          { amount: 1, gramWeight: 0, measureUnit: { name: "piece" } },
          { amount: 1, gramWeight: 85, measureUnit: { name: "RACC" } },
          { amount: 1, gramWeight: 28.4, measureUnit: { name: "oz" } },
        ],
      }),
    );

    expect(record).toMatchObject({
      quantityServing: 100,
      servingLabel: "g",
      quantityMass: 100,
      massUnit: "g",
      quantityVolume: null,
      volumeUnit: null,
    });
  });

  it("preserves source-reported zero nutrients as zero", () => {
    const { record, unreportedNutrients } = mappedRecord(
      food({
        foodNutrients: [
          nutrient(1008, 0),
          nutrient(1003, 0),
          nutrient(1004, 0),
          nutrient(1005, 0),
          nutrient(1258, 0),
          nutrient(1253, 0),
          nutrient(1093, 0),
          nutrient(1079, 0),
          nutrient(2000, 0),
        ],
      }),
    );

    expect(record.calories).toBe(0);
    expect(record.proteinGrams).toBe(0);
    expect(record.totalFatGrams).toBe(0);
    expect(record.totalCarbohydrateGrams).toBe(0);
    expect(record.saturatedFatGrams).toBe(0);
    expect(record.cholesterolMg).toBe(0);
    expect(record.sodiumMg).toBe(0);
    expect(record.fiberGrams).toBe(0);
    expect(record.sugarGrams).toBe(0);
    expect(unreportedNutrients).toEqual([]);
  });

  it("represents Unreported nutrients as zero and lists them by USDA identity", () => {
    const { record, unreportedNutrients } = mappedRecord(
      food({
        description: "Salt, table, iodized",
        fdcId: 746775,
        foodNutrients: [nutrient(1093, 38758)],
        foodPortions: [],
      }),
    );

    expect(record.calories).toBe(0);
    expect(record.proteinGrams).toBe(0);
    expect(record.sodiumMg).toBe(38758);
    expect(unreportedNutrients).toEqual([
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Energy" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Protein" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Total fat" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Carbohydrate" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Saturated fat" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Cholesterol" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Fiber" },
      { sourceFoodId: "746775", description: "Salt, table, iodized", nutrient: "Sugars" },
    ]);
  });

  it("uses USDA Atwater kcal energy when nutrient 1008 is absent", () => {
    const { record, unreportedNutrients } = mappedRecord(
      food({
        foodNutrients: [nutrient(2048, 200), nutrient(1003, 8), nutrient(1004, 10), nutrient(1005, 14)],
        foodPortions: [],
      }),
    );

    expect(record.calories).toBe(200);
    expect(unreportedNutrients.map((entry) => entry.nutrient)).not.toContain("Energy");
  });

  it("records a record-local mapping error for a malformed food", () => {
    expect(mapFoundationFood(null, 363)).toEqual({
      ok: false,
      error: {
        sourceFoodId: "",
        description: "",
        error: "Source record at index 363 is missing or not an object",
      },
    });
    expect(mapFoundationFood({ description: "Mystery food" })).toMatchObject({
      ok: false,
      error: {
        description: "Mystery food",
        error: "Source record is missing a positive USDA food identity",
      },
    });
    expect(mapFoundationFood({ fdcId: 123, description: "   " })).toMatchObject({
      ok: false,
      error: {
        sourceFoodId: "123",
        error: "Source record is missing a food description",
      },
    });
  });
});

describe("mapFoundationFoods", () => {
  it("skips record-local mapping failures without discarding importable foods", () => {
    const summary = mapFoundationFoods([food(), null, { description: "Broken" }]);

    expect(summary.totalRecordCount).toBe(3);
    expect(summary.importableRecordCount).toBe(1);
    expect(summary.mappingErrorCount).toBe(2);
    expect(summary.records[0]?.sourceFoodId).toBe("321358");
    expect(summary.mappingErrors.map((entry) => entry.error)).toEqual([
      "Source record at index 1 is missing or not an object",
      "Source record is missing a positive USDA food identity",
    ]);
  });
});
