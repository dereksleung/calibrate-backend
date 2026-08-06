import { apiTransport } from "#/shared/api/api-client.ts";
import { useFoodSearch } from "@calibrate/api-client";
import type { FoodSearchResult } from "@calibrate/api-contracts";
import { useEffect, useMemo, useState } from "react";

import type { FoodConfirmationState, SelectedFoodForConfirmation } from "./food-confirmation-state.ts";
import { FoodSearchPage } from "./components/FoodSearchPage.tsx";

type FoodSearchProps = {
  preselectedMeal?: FoodConfirmationState["preselectedMeal"];
};

function toConfirmationFood(food: FoodSearchResult): SelectedFoodForConfirmation {
  return {
    id: food.source === "catalog" ? food.catalogFoodId : food.foodEntryId,
    name: food.name,
    brand: food.brand ?? undefined,
    calories: food.calories,
    quantityServing: food.quantityServing,
    servingLabel: food.servingLabel,
    lastUsedLabel: food.source === "recent" ? food.recency.displayLabel : undefined,
  };
}

export function FoodSearch({ preselectedMeal }: FoodSearchProps) {
  const [selectedFood, setSelectedFood] = useState<FoodConfirmationState | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const activeSearch = debouncedQuery.length >= 3 ? { query: debouncedQuery } : null;
  const search = useFoodSearch(apiTransport, activeSearch);
  const foods = useMemo(() => search.data?.results.map(toConfirmationFood), [search.data]);
  const state = activeSearch ? search.isPending ? "loading" : search.isError ? "error" : foods?.length === 0 ? "empty" : "ready" : "ready";

  return (
    <>
      <FoodSearchPage
        query={query}
        onQueryChange={setQuery}
        recentFoods={activeSearch ? foods ?? [] : undefined}
        state={state}
        onSelectFood={(state) => setSelectedFood({ ...state, preselectedMeal })}
      />
      {selectedFood ? (
        <p role="status" className="sr-only">
          {`${selectedFood.food.name} selected for confirmation.`}
        </p>
      ) : null}
    </>
  );
}
