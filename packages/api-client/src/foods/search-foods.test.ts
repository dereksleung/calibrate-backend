import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";
import { searchFoods } from "./search-foods.js";

describe("searchFoods", () => {
  it("validates shared input and requests the cursor-aware staged-search endpoint", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse({ results: [], nextCursor: null }));
    const transport = { request } as unknown as ApiTransport;

    await expect(searchFoods(transport, { query: "  greek yogurt ", cursor: "next-page", limit: 10 })).resolves.toEqual({ results: [], nextCursor: null });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      path: "/foods/search", query: { query: "greek yogurt", cursor: "next-page", limit: 10 },
    }));
    expect(() => searchFoods(transport, { query: "yo" })).toThrow();
  });
});
