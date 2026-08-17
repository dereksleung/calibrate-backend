// @vitest-environment jsdom

import { createQueryClient } from "#/shared/api/query-client.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "../../routeTree.gen.ts";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

beforeEach(() => {
  window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);

    if (url.includes("/auth/session")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
              email: "person@example.com",
              tier: "FREE",
              createdAt: "2030-01-01T00:00:00.000Z",
              updatedAt: "2030-01-01T00:00:00.000Z",
            },
            sessionTransport: "cookie",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    }

    if (url.includes("/foods/search")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                source: "catalog",
                catalogFoodId: "2d38c136-5633-4b22-9553-b8a587dd6ba6",
                sourceLabel: "USDA FoodData Central",
                name: "Greek yogurt",
                brand: "Calibrate Kitchen",
                calories: 150,
                totalFatGrams: 4,
                saturatedFatGrams: 2,
                cholesterolMg: 10,
                sodiumMg: 65,
                totalCarbohydrateGrams: 8,
                fiberGrams: 0,
                sugarGrams: 6,
                proteinGrams: 18,
                quantityServing: 1,
                servingLabel: "cup",
                quantityMass: null,
                massUnit: null,
                quantityVolume: null,
                volumeUnit: null,
              },
            ],
            nextCursor: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    }

    if (url.includes("/food-entries")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "created-entry",
            name: "Zero Sugar Oat",
            brand: "Earth's Own",
            meal: "BREAKFAST",
            chosenQuantity: 1,
            chosenUnit: "cup",
            calories: 40,
            totalFatGrams: 1,
            saturatedFatGrams: 0,
            cholesterolMg: 0,
            sodiumMg: 120,
            totalCarbohydrateGrams: 7,
            fiberGrams: 2,
            sugarGrams: 1,
            proteinGrams: 3,
            quantityServing: 1,
            servingLabel: "cup",
            quantityMass: null,
            massUnit: null,
            quantityVolume: null,
            volumeUnit: null,
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );
    }

    if (url.includes("/daylogs/")) {
      return Promise.resolve(
        new Response(JSON.stringify(null), { status: 200, headers: { "content-type": "application/json" } }),
      );
    }

    return Promise.resolve(new Response("not found", { status: 404 }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderFoodSearchRoute() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/logs/food-search?date=2026-05-18&meal=BREAKFAST"],
    }),
    defaultPreload: "intent",
    scrollRestoration: false,
  });

  return {
    router,
    ...render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

describe("food search route", () => {
  it("carries the selected food and meal into the confirmation route", async () => {
    const { router } = renderFoodSearchRoute();

    fireEvent.click(await screen.findByRole("button", { name: /select Zero Sugar Oat/i }));

    expect(await screen.findByRole("heading", { name: "Add Food" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/logs/confirm-food");
    expect(router.state.location.search).toMatchObject({ date: "2026-05-18" });
    expect(router.state.location.state.foodConfirmation).toMatchObject({
      food: { name: "Zero Sugar Oat" },
      preselectedMeal: "BREAKFAST",
    });
  });

  it("debounces typed searches and renders the backend-provided result order", async () => {
    renderFoodSearchRoute();

    fireEvent.change(await screen.findByRole("searchbox", { name: "Search foods" }), {
      target: { value: "greek yogurt" },
    });

    expect(await screen.findByRole("button", { name: /select Greek yogurt/i })).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/foods/search?query=greek+yogurt"),
      expect.any(Object),
    );
  });

  it("saves the confirmation and returns to the selected daily log", async () => {
    const { router } = renderFoodSearchRoute();
    fireEvent.click(await screen.findByRole("button", { name: /select Zero Sugar Oat/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));

    await screen.findByRole("heading", { name: "Monday, May 18" });
    expect(router.state.location.pathname).toBe("/logs");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/daylogs/2026-05-18/food-entries"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
