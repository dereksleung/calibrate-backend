import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { mapFoundationFoods, type FoundationFoodsMappingSummary } from "./foundation-foods-mapper.js";

export const FOUNDATION_FOODS_RELEASE_ID = "FoodData_Central_foundation_food_json_2026-04-30";
export const FOUNDATION_FOODS_RELEASE_DATE = "2026-04-30";
export const FOUNDATION_FOODS_SOURCE_FILE_NAME = "FoodData_Central_foundation_food_json_2026-04-30.json";

export const DEFAULT_FOUNDATION_FOODS_SOURCE_DIRECTORY = path.resolve(
  import.meta.dirname,
  "../../../data/foundation-foods",
);

export interface FoundationFoodsSourceManifest {
  releaseId: string;
  releaseDate: string;
  sourceFile: string;
  sha256: string;
  expectedTotalRecordCount: number;
  expectedImportableRecordCount: number;
  expectedMappingErrorCount: number;
  expectedUnreportedNutrientCount: number;
}

export interface FoundationFoodsPreflightResult extends FoundationFoodsMappingSummary {
  releaseId: string;
  releaseDate: string;
  sourceFile: string;
  sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function assertPinnedFoundationFoodsIdentity(
  manifest: FoundationFoodsSourceManifest,
  archivePath: string,
): void {
  if (
    manifest.releaseId !== FOUNDATION_FOODS_RELEASE_ID ||
    manifest.releaseDate !== FOUNDATION_FOODS_RELEASE_DATE ||
    manifest.sourceFile !== FOUNDATION_FOODS_SOURCE_FILE_NAME ||
    manifest.sourceFile !== path.basename(archivePath)
  ) {
    throw new Error("Foundation Foods source manifest identity mismatch");
  }
}

export function readFoundationFoodsManifest(manifestPath: string): FoundationFoodsSourceManifest {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Foundation Foods source manifest is invalid");
  const expectedTotalRecordCount = readInteger(parsed.expectedTotalRecordCount);
  const expectedImportableRecordCount = readInteger(parsed.expectedImportableRecordCount);
  const expectedMappingErrorCount = readInteger(parsed.expectedMappingErrorCount);
  const expectedUnreportedNutrientCount = readInteger(parsed.expectedUnreportedNutrientCount);
  if (
    typeof parsed.releaseId !== "string" ||
    typeof parsed.releaseDate !== "string" ||
    typeof parsed.sourceFile !== "string" ||
    typeof parsed.sha256 !== "string" ||
    expectedTotalRecordCount === null ||
    expectedImportableRecordCount === null ||
    expectedMappingErrorCount === null ||
    expectedUnreportedNutrientCount === null
  ) {
    throw new Error("Foundation Foods source manifest is invalid");
  }

  return {
    releaseId: parsed.releaseId,
    releaseDate: parsed.releaseDate,
    sourceFile: parsed.sourceFile,
    sha256: parsed.sha256.toLowerCase(),
    expectedTotalRecordCount,
    expectedImportableRecordCount,
    expectedMappingErrorCount,
    expectedUnreportedNutrientCount,
  };
}

export function parseFoundationFoodsEnvelope(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.FoundationFoods)) {
    throw new Error("Foundation Foods source envelope is invalid");
  }
  return value.FoundationFoods;
}

export function hashFoundationFoodsArchive(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function preflightFoundationFoodsSource(options: {
  archivePath: string;
  manifest: FoundationFoodsSourceManifest;
}): FoundationFoodsPreflightResult {
  assertPinnedFoundationFoodsIdentity(options.manifest, options.archivePath);

  let archiveBytes: Buffer;
  try {
    archiveBytes = readFileSync(options.archivePath);
  } catch {
    throw new Error("Foundation Foods archive is unreadable");
  }

  const sha256 = hashFoundationFoodsArchive(archiveBytes);
  if (sha256 !== options.manifest.sha256.toLowerCase()) {
    throw new Error("Foundation Foods archive checksum mismatch");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(archiveBytes.toString("utf8"));
  } catch {
    throw new Error("Foundation Foods archive is unreadable");
  }

  const foods = parseFoundationFoodsEnvelope(parsed);
  const mapped = mapFoundationFoods(foods);
  if (
    mapped.totalRecordCount !== options.manifest.expectedTotalRecordCount ||
    mapped.importableRecordCount !== options.manifest.expectedImportableRecordCount ||
    mapped.mappingErrorCount !== options.manifest.expectedMappingErrorCount ||
    mapped.unreportedNutrientCount !== options.manifest.expectedUnreportedNutrientCount
  ) {
    throw new Error("Foundation Foods source summary does not match the committed manifest");
  }

  return {
    releaseId: options.manifest.releaseId,
    releaseDate: options.manifest.releaseDate,
    sourceFile: options.manifest.sourceFile,
    sha256,
    ...mapped,
  };
}

export function defaultFoundationFoodsArchivePath(
  sourceDirectory = DEFAULT_FOUNDATION_FOODS_SOURCE_DIRECTORY,
): string {
  return path.join(sourceDirectory, FOUNDATION_FOODS_SOURCE_FILE_NAME);
}

export function defaultFoundationFoodsManifestPath(
  sourceDirectory = DEFAULT_FOUNDATION_FOODS_SOURCE_DIRECTORY,
): string {
  return path.join(sourceDirectory, "manifest.json");
}
