import { describe, expect, it, vi } from "vitest";

import { FoodSearchController } from "./food-search-controller.js";

describe("FoodSearchController", () => {
  it("validates the query and scopes the staged search to the authenticated user", async () => {
    const search = vi.fn().mockResolvedValue({ results: [], nextCursor: null });
    const controller = new FoodSearchController({ search });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await controller.search({ auth: { userId: "user-1" }, query: { query: " greek yogurt ", limit: "10" } } as never, { status, json } as never);

    expect(search).toHaveBeenCalledWith({ userId: "user-1", query: "greek yogurt", limit: 10 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ results: [], nextCursor: null });
  });

  it("rejects an unvalidated query before calling the service", async () => {
    const search = vi.fn();
    const controller = new FoodSearchController({ search });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await controller.search({ auth: { userId: "user-1" }, query: { query: "yo" } } as never, { status, json } as never);

    expect(search).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});
