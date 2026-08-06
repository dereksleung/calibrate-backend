import { ConfirmFood } from "#/pages/logs/ConfirmFood.tsx";
import { parseFoodConfirmationState } from "#/pages/logs/food-confirmation-state.ts";
import { normalizeFoodSearchRouteSearch } from "#/pages/logs/log-page-helpers.ts";
import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/logs/confirm-food")({
  validateSearch: normalizeFoodSearchRouteSearch,
  beforeLoad: ({ location, search }) => {
    if (!parseFoodConfirmationState(location.state.foodConfirmation)) {
      throw redirect({
        replace: true,
        to: "/logs/food-search",
        search: { date: search.date, ...(search.meal ? { meal: search.meal } : {}) },
      });
    }
  },
  component: ConfirmFoodRoute,
});

function ConfirmFoodRoute() {
  const confirmation = parseFoodConfirmationState(
    useRouterState({ select: (state) => state.location.state.foodConfirmation }),
  );

  return confirmation ? <ConfirmFood confirmation={confirmation} /> : null;
}
