import { Goals } from "#/pages/goals/Goals.tsx";
import { createFileRoute } from "@tanstack/react-router";

type GoalsSearch = {
  openFatsAnalytics?: boolean;
};

export const Route = createFileRoute("/goals")({
  validateSearch: (search: Record<string, unknown>): GoalsSearch => {
    const openFatsAnalytics = search.openFatsAnalytics === true || search.openFatsAnalytics === "true";

    return openFatsAnalytics ? { openFatsAnalytics } : {};
  },
  component: GoalsRoute,
});

function GoalsRoute() {
  const { openFatsAnalytics } = Route.useSearch();

  return <Goals openFatsAnalytics={openFatsAnalytics} />;
}
