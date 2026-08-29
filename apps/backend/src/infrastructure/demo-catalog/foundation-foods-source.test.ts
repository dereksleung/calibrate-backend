import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { FoundationFoodsSourceManifest } from "./foundation-foods-source.js";

import {
  defaultFoundationFoodsArchivePath,
  defaultFoundationFoodsManifestPath,
  hashFoundationFoodsArchive,
  parseFoundationFoodsEnvelope,
  preflightFoundationFoodsSource,
  readFoundationFoodsManifest,
} from "./foundation-foods-source.js";

function nutrient(id: number, amount: number) {
  return { nutrient: { id }, amount };
}

function importableFood(fdcId = 321358) {
  return {
    fdcId,
    description: `Food ${fdcId}`,
    foodNutrients: [
      nutrient(1008, 100),
      nutrient(1003, 8),
      nutrient(1004, 4),
      nutrient(1005, 12),
      nutrient(1258, 1),
      nutrient(1253, 0),
      nutrient(1093, 50),
      nutrient(1079, 2),
      nutrient(2000, 1),
    ],
    foodPortions: [],
  };
}

function writeArchive(
  foods: unknown[],
  directory = mkdtempSync(path.join(os.tmpdir(), "foundation-foods-")),
) {
  const archivePath = path.join(directory, "FoodData_Central_foundation_food_json_2026-04-30.json");
  const bytes = Buffer.from(JSON.stringify({ FoundationFoods: foods }), "utf8");
  writeFileSync(archivePath, bytes);
  return { archivePath, bytes, directory };
}

function manifestFor(
  bytes: Buffer,
  overrides: Partial<FoundationFoodsSourceManifest> = {},
): FoundationFoodsSourceManifest {
  return {
    releaseId: "FoodData_Central_foundation_food_json_2026-04-30",
    releaseDate: "2026-04-30",
    sourceFile: "FoodData_Central_foundation_food_json_2026-04-30.json",
    sha256: hashFoundationFoodsArchive(bytes),
    expectedTotalRecordCount: 1,
    expectedImportableRecordCount: 1,
    expectedMappingErrorCount: 0,
    expectedUnreportedNutrientCount: 0,
    ...overrides,
  };
}

describe("parseFoundationFoodsEnvelope", () => {
  it("rejects a source envelope that is not a Foundation Foods array", () => {
    expect(() => parseFoundationFoodsEnvelope({ SRLegacyFoods: [] })).toThrow(
      "Foundation Foods source envelope is invalid",
    );
    expect(() => parseFoundationFoodsEnvelope([])).toThrow("Foundation Foods source envelope is invalid");
  });
});

describe("readFoundationFoodsManifest", () => {
  it("rejects a manifest that omits expected aggregate totals", () => {
    const manifestPath = path.join(
      mkdtempSync(path.join(os.tmpdir(), "foundation-manifest-")),
      "manifest.json",
    );
    writeFileSync(manifestPath, JSON.stringify({ releaseId: "x", sha256: "abc" }));

    expect(() => readFoundationFoodsManifest(manifestPath)).toThrow(
      "Foundation Foods source manifest is invalid",
    );
  });
});

describe("preflightFoundationFoodsSource", () => {
  it("fails before mapping when the archive checksum does not match the manifest", () => {
    const { archivePath, bytes } = writeArchive([importableFood()]);
    const digest = createHash("sha256").update(bytes).digest("hex");

    expect(() =>
      preflightFoundationFoodsSource({
        archivePath,
        manifest: manifestFor(bytes, { sha256: "0".repeat(64) }),
      }),
    ).toThrow("Foundation Foods archive checksum mismatch");
    expect(digest).toHaveLength(64);
  });

  it("fails when the observed aggregate summary does not match the committed manifest", () => {
    const { archivePath, bytes } = writeArchive([importableFood(), null]);

    expect(() =>
      preflightFoundationFoodsSource({
        archivePath,
        manifest: manifestFor(bytes, {
          expectedTotalRecordCount: 2,
          expectedImportableRecordCount: 2,
          expectedMappingErrorCount: 0,
          expectedUnreportedNutrientCount: 0,
        }),
      }),
    ).toThrow("Foundation Foods source summary does not match the committed manifest");
  });

  it("accepts a checksummed archive whose mapped totals match the manifest", () => {
    const { archivePath, bytes } = writeArchive([importableFood(), null]);
    const result = preflightFoundationFoodsSource({
      archivePath,
      manifest: manifestFor(bytes, {
        expectedTotalRecordCount: 2,
        expectedImportableRecordCount: 1,
        expectedMappingErrorCount: 1,
        expectedUnreportedNutrientCount: 0,
      }),
    });

    expect(result.importableRecordCount).toBe(1);
    expect(result.mappingErrorCount).toBe(1);
    expect(result.records[0]?.sourceFoodId).toBe("321358");
  });

  it("accepts the committed Foundation Foods archive against its source manifest", () => {
    const result = preflightFoundationFoodsSource({
      archivePath: defaultFoundationFoodsArchivePath(),
      manifest: readFoundationFoodsManifest(defaultFoundationFoodsManifestPath()),
    });

    expect(result.totalRecordCount).toBe(395);
    expect(result.importableRecordCount).toBe(363);
    expect(result.mappingErrorCount).toBe(32);
    expect(result.unreportedNutrientCount).toBe(1096);
  });
});
