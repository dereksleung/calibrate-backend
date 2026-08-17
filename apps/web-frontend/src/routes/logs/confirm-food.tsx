import { ConfirmFood } from "#/pages/logs/ConfirmFood/ConfirmFood.tsx";
import { parseFoodConfirmationState } from "#/pages/logs/food-confirmation-state.ts";
import { normalizeFoodSearchRouteSearch } from "#/pages/logs/log-page-helpers.ts";
import { apiTransport } from "#/shared/api/api-client.ts";
import { useSaveFoodEntry } from "@calibrate/api-client";
import { createFileRoute, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const { date } = Route.useSearch();
  const confirmation = parseFoodConfirmationState(
    useRouterState({ select: (state) => state.location.state.foodConfirmation }),
  );
  const save = useSaveFoodEntry(apiTransport, date, {
    onSuccess: () => {
      void navigate({ to: "/logs", search: { date } });
    },
    onError: () => {
      toast.error("We couldn't save that food. Your edits are still here.", { closeButton: true });
    },
  });

  return confirmation ? (
    <ConfirmFood
      confirmation={confirmation}
      isSaving={save.isPending}
      onCancel={() => void navigate({ to: "/logs/food-search", search: { date } })}
      onSave={(entry) => save.mutate(entry)}
    />
  ) : null;
}
