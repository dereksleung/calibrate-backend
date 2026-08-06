import type { IFoodCatalogImporter } from "@application/ports/food-catalog-importer.js";
import type { FoodCatalogRecord, IFoodCatalogWriter } from "@application/ports/food-catalog-writer.js";

import { mapFdcSearchFood, type FdcSearchFood } from "./food-data-central-mappers.js";

interface FdcSearchResponse { foods?: FdcSearchFood[]; }
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function normalizeQuery(query: string): string { return query.trim().toLowerCase().replace(/\s+/g, " "); }

export class FoodDataCentralCatalogImporter implements IFoodCatalogImporter {
  private readonly cache = new Map<string, { expiresAt: number; result: FoodCatalogRecord[] }>();
  private readonly inFlight = new Map<string, Promise<FoodCatalogRecord[]>>();
  private readonly fetch: FetchLike;

  constructor({ apiKey, writer, fetch = globalThis.fetch.bind(globalThis), baseUrl = "https://api.nal.usda.gov/fdc/v1" }: {
    apiKey: string; writer: IFoodCatalogWriter; fetch?: FetchLike; baseUrl?: string;
  }) {
    if (!apiKey) throw new Error("FOODDATA_CENTRAL_API_KEY is not configured");
    this.apiKey = apiKey;
    this.writer = writer;
    this.fetch = fetch;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private readonly apiKey: string;
  private readonly writer: IFoodCatalogWriter;
  private readonly baseUrl: string;

  async searchAndImport(query: string, limit: number): Promise<FoodCatalogRecord[]> {
    const normalizedQuery = normalizeQuery(query);
    const cached = this.cache.get(normalizedQuery);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    const existing = this.inFlight.get(normalizedQuery);
    if (existing) return existing;
    const request = this.fetchAndImport(normalizedQuery, Math.min(limit, 25));
    this.inFlight.set(normalizedQuery, request);
    try { return await request; } finally { this.inFlight.delete(normalizedQuery); }
  }

  private async fetchAndImport(query: string, limit: number): Promise<FoodCatalogRecord[]> {
    const timeout = AbortSignal.timeout(3_000);
    const response = await this.fetch(`${this.baseUrl}/foods/search?${new URLSearchParams({ query, pageSize: String(limit), api_key: this.apiKey })}`, { signal: timeout });
    if (!response.ok) throw new Error("Food catalog provider is temporarily unavailable");
    const payload: unknown = await response.json();
    const foods = isFdcSearchResponse(payload) ? payload.foods ?? [] : [];
    const records = await Promise.all(foods.map(mapFdcSearchFood).filter((food): food is NonNullable<typeof food> => food !== null).slice(0, limit).map((food) => this.writer.upsert(food)));
    this.cache.set(query, { result: records, expiresAt: Date.now() + 60_000 });
    return records;
  }
}

function isFdcSearchResponse(value: unknown): value is FdcSearchResponse {
  return typeof value === "object" && value !== null && (!("foods" in value) || Array.isArray(value.foods));
}
