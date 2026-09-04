import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";

import { dayLogRangeQueryKeyPrefix } from "./get-day-log-range.js";
import { dayLogQueryKey } from "./get-day-log.js";
import { invalidateDayLogQueries, saveFoodEntry } from "./save-food-entry.js";

describe("saveFoodEntry", () => {
  it("validates the selected day and posts a confirmed food entry", async () => {
    const request = vi.fn(async ({ responseBodySchema }) =>
      responseBodySchema.parse({
        id: "entry-1",
        name: "Tofu",
        brand: null,
        meal: "LUNCH",
        chosenQuantity: 1,
        chosenUnit: "serving",
        calories: 222,
        totalFatGrams: 12.7,
        saturatedFatGrams: 1.8,
        cholesterolMg: 0,
        sodiumMg: 100,
        totalCarbohydrateGrams: 3.2,
        fiberGrams: 1,
        sugarGrams: 0,
        proteinGrams: 23.9,
        quantityServing: 1,
        servingLabel: "serving",
        quantityMass: null,
        massUnit: null,
        quantityVolume: null,
        volumeUnit: null,
      }),
    );
    const transport = { request } as unknown as ApiTransport;

    await saveFoodEntry(transport, "2026-05-18", {
      name: "Tofu",
      brand: null,
      meal: "LUNCH",
      chosenQuantity: 1,
      chosenUnit: "serving",
      calories: 222,
      totalFatGrams: 12.7,
      saturatedFatGrams: 1.8,
      cholesterolMg: 0,
      sodiumMg: 100,
      totalCarbohydrateGrams: 3.2,
      fiberGrams: 1,
      sugarGrams: 0,
      proteinGrams: 23.9,
      quantityServing: 1,
      servingLabel: "serving",
      quantityMass: null,
      massUnit: null,
      quantityVolume: null,
      volumeUnit: null,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/daylogs/2026-05-18/food-entries",
        body: expect.objectContaining({ meal: "LUNCH" }),
      }),
    );
  });
});

describe("invalidateDayLogQueries", () => {
  it("invalidates only the confirmed account's selected day and cached day-log ranges", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const accountId = "e74942b3-78d7-48e8-bd20-dc5eba7f82ff";

    await invalidateDayLogQueries({ invalidateQueries } as never, accountId, "2026-05-18");

    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: dayLogQueryKey(accountId, "2026-05-18"),
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: dayLogRangeQueryKeyPrefix(accountId),
    });
  });
});
