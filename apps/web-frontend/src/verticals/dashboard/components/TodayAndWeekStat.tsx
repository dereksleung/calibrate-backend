import type { DashboardNutritionCardModel } from "#/verticals/dashboard/dashboard-nutrition-model.ts";

import { TodayAndWeekNutritionCard } from "#/verticals/dashboard/components/TodayAndWeekNutritionCard.tsx";

export const TodayAndWeekStat = ({ model }: { model: DashboardNutritionCardModel }) => (
  <TodayAndWeekNutritionCard model={model} />
);
