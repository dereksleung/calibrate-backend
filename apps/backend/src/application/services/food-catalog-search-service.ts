import { BusinessLogicError } from "@domain/errors/business-logic-error.js";

import type { IFoodCatalogImporter } from "../ports/food-catalog-importer.js";
import type { IFoodCatalogSearchQuery } from "../ports/food-catalog-search-query.js";
import type { FoodCatalogRecord } from "../ports/food-catalog-writer.js";
import type { IRecentFoodQuery, RecentFoodRecord } from "../ports/recent-food-query.js";

export interface FoodCatalogSearchInput {
  userId: string;
  query: string;
  limit: number;
  cursor?: string;
}

export type FoodCatalogSearchResult =
  | { kind: "catalog"; food: FoodCatalogRecord }
  | { kind: "recent"; food: RecentFoodRecord };

export interface FoodCatalogSearchOutput {
  results: FoodCatalogSearchResult[];
  nextCursor: string | null;
}

function readOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "offset" in value &&
      typeof value.offset === "number" &&
      Number.isInteger(value.offset) &&
      value.offset >= 0
    )
      return value.offset;
  } catch {
    /* validation below maps malformed cursors to a safe 400 */
  }
  throw new BusinessLogicError("Invalid search cursor");
}

function writeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

/** Coordinates local private/catalog reads; the external importer is zero-local-hit only. */
export class FoodCatalogSearchService {
  constructor(
    private readonly catalogSearchQuery: IFoodCatalogSearchQuery,
    private readonly recentFoodQuery: IRecentFoodQuery,
    private readonly catalogImporter: IFoodCatalogImporter,
  ) {}

  /**
   * TO-DOs:
   * - Find sources of data to pre-populate the catalog with, so that we can avoid hitting external APIs and their rate limits for every search.
   * - Save external API results to the catalog so that it naturally grows over time, also reducing the need to hit external APIs.
   * - Optimize further, plan system design and scaling for this hot read path of searching.
   */
  async search(input: FoodCatalogSearchInput): Promise<FoodCatalogSearchOutput> {
    const offset = readOffset(input.cursor);
    const fetchLimit = Math.min(input.limit + offset + 1, 100);
    const [catalogFoods, recentFoods] = await Promise.all([
      this.catalogSearchQuery.search({ query: input.query, limit: fetchLimit }),
      this.recentFoodQuery.search({ userId: input.userId, query: input.query, limit: fetchLimit }),
    ]);

    if (catalogFoods.length === 0 && recentFoods.length === 0) {
      const importedFoods = await this.catalogImporter.searchAndImport(input.query, input.limit);
      const results = importedFoods.map((food) => ({ kind: "catalog" as const, food }));
      return {
        results: results.slice(offset, offset + input.limit),
        nextCursor: results.length > offset + input.limit ? writeCursor(offset + input.limit) : null,
      };
    }

    const catalogIdsAlreadyRepresented = new Set(
      recentFoods.flatMap((food) => (food.catalogFoodId ? [food.catalogFoodId] : [])),
    );
    const combinedResults = [
      ...recentFoods.map((food) => ({ kind: "recent" as const, food })),
      ...catalogFoods
        .filter((food) => !catalogIdsAlreadyRepresented.has(food.id))
        .map((food) => ({ kind: "catalog" as const, food })),
    ];
    const results = combinedResults.slice(offset, offset + input.limit);

    return {
      results,
      nextCursor: combinedResults.length > offset + input.limit ? writeCursor(offset + input.limit) : null,
    };
  }
}
