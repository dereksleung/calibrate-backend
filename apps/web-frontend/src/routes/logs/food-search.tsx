import { createFileRoute } from "@tanstack/react-router";

import { FoodSearch } from "#/pages/logs/FoodSearch.tsx";
import { normalizeFoodSearchRouteSearch } from "#/pages/logs/log-page-helpers.ts";

export const Route = createFileRoute("/logs/food-search")({
  validateSearch: normalizeFoodSearchRouteSearch,
  component: FoodSearchRoute,
});

function FoodSearchRoute() {
  const { date, meal } = Route.useSearch();

  return <FoodSearch selectedDate={date} preselectedMeal={meal} />;
}
