import { WarningBanner } from "#/shared/components/base/WarningBanner.tsx";
import { Search } from "lucide-react";

import type { FoodConfirmationState, SelectedFoodForConfirmation } from "../food-confirmation-state.ts";

import { FoodResultCard } from "./FoodResultCard.tsx";

type FoodSearchState = "ready" | "loading" | "empty" | "error";

type FoodSearchPageProps = {
  recentFoods?: SelectedFoodForConfirmation[];
  state?: FoodSearchState;
  query?: string;
  onQueryChange?: (query: string) => void;
  onSelectFood?: (state: FoodConfirmationState) => void;
};

export const mockRecentFoods: SelectedFoodForConfirmation[] = [
  {
    id: "mock-oat",
    name: "Zero Sugar Oat",
    calories: 40,
    quantityServing: 1,
    servingLabel: "cup",
    brand: "Earth's Own",
  },
  {
    id: "mock-protein",
    name: "Protein and Greens - Chocolate",
    calories: 150,
    quantityServing: 1,
    servingLabel: "scoop",
    brand: "Vega",
  },
  {
    id: "mock-chickpeas",
    name: "Chickpeas and Tofu",
    calories: 376,
    quantityServing: 1,
    servingLabel: "meal",
  },
  {
    id: "mock-avocado-toast",
    name: "Avocado Toast",
    calories: 250,
    quantityServing: 2,
    servingLabel: "slices",
    brand: "Homemade",
  },
];

function RecentFoodSkeletons() {
  return (
    <div aria-busy="true" aria-label="Loading recently logged foods" className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="glass-card rounded-2xl px-5 py-4">
          <div className="h-5 w-2/5 animate-pulse rounded-full bg-surface-container-high" />
          <div className="mt-3 h-4 w-3/5 animate-pulse rounded-full bg-surface-container-high" />
        </div>
      ))}
    </div>
  );
}

export function FoodSearchPage({
  recentFoods = mockRecentFoods,
  state = "ready",
  query = "",
  onQueryChange,
  onSelectFood,
}: FoodSearchPageProps) {
  const isSearching = query.trim().length >= 3;
  const heading = isSearching ? "Search results" : "Recently logged";
  return (
    <main className="min-h-screen bg-surface subtle-aurora-fade-page-background px-6 pb-24 pt-8 antialiased md:px-10 md:pt-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-secondary"
            strokeWidth={1.75}
          />
          <input
            type="search"
            aria-label="Search foods"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder="Search foods, brands, flavors..."
            className="glass-card h-12 w-full rounded-full py-3 pl-12 pr-5 text-sm text-on-surface outline-none placeholder:text-secondary focus:ring-3 focus:ring-ring/30"
          />
        </div>

        <section aria-labelledby="recently-logged-heading" className="mt-10">
          <h1
            id="recently-logged-heading"
            className="font-heading text-2xl font-normal tracking-tight text-on-surface"
          >
            {heading}
          </h1>

          <div className="mt-4">
            {state === "loading" ? <RecentFoodSkeletons /> : null}
            {state === "empty" ? (
              <p
                role="status"
                className="rounded-2xl bg-surface-container-low px-5 py-6 text-on-surface-variant"
              >
                No results.
              </p>
            ) : null}
            {state === "error" ? <WarningBanner>Could not search.</WarningBanner> : null}
            {state === "ready" ? (
              <ul role="list" className="space-y-3">
                {recentFoods.map((food) => (
                  <FoodResultCard
                    key={food.id}
                    food={food}
                    onSelect={(selectedFood) => onSelectFood?.({ food: selectedFood })}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
