import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";
import { saveFoodEntry } from "./save-food-entry.js";

describe("saveFoodEntry", () => {
  it("validates the selected day and posts a confirmed food entry", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse({
      id: "entry-1", name: "Tofu", brand: null, meal: "LUNCH", chosenQuantity: 1, chosenUnit: "serving",
      calories: 222, totalFatGrams: 12.7, saturatedFatGrams: 1.8, cholesterolMg: 0, sodiumMg: 100,
      totalCarbohydrateGrams: 3.2, fiberGrams: 1, sugarGrams: 0, proteinGrams: 23.9,
      quantityServing: 1, servingLabel: "serving", quantityMass: null, massUnit: null, quantityVolume: null, volumeUnit: null,
    }));
    const transport = { request } as unknown as ApiTransport;

    await saveFoodEntry(transport, "2026-05-18", {
      name: "Tofu", brand: null, meal: "LUNCH", chosenQuantity: 1, chosenUnit: "serving",
      calories: 222, totalFatGrams: 12.7, saturatedFatGrams: 1.8, cholesterolMg: 0, sodiumMg: 100,
      totalCarbohydrateGrams: 3.2, fiberGrams: 1, sugarGrams: 0, proteinGrams: 23.9,
      quantityServing: 1, servingLabel: "serving", quantityMass: null, massUnit: null, quantityVolume: null, volumeUnit: null,
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", path: "/daylogs/2026-05-18/food-entries", body: expect.objectContaining({ meal: "LUNCH" }),
    }));
  });
});
