import type { WeeklyDatum } from "#/shared/components/charts/WeeklyBarChart.tsx";
import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import { getLocalWeekdayAbbreviation, getRollingSevenDayDateRange } from "#/shared/date/local-date-range.ts";
import {
  DAILY_TARGETS,
  getDayLogNutritionTotals,
  type NutritionTotals,
} from "#/shared/nutrition/nutrition-totals.ts";

export type DashboardNutritionMetric = keyof NutritionTotals;

export type DashboardNutritionCardModel = {
  title: "Calories" | "Fats" | "Protein" | "Carbs";
  unit: "calorie" | "gram";
  today: Pick<WeeklyDatum, "eaten" | "limit">;
  weeklyData: WeeklyDatum[];
};

export type DashboardNutritionModels = Record<DashboardNutritionMetric, DashboardNutritionCardModel>;

type NutritionMetricConfiguration = {
  metric: DashboardNutritionMetric;
  title: DashboardNutritionCardModel["title"];
  unit: DashboardNutritionCardModel["unit"];
};

const METRIC_CONFIGURATIONS: readonly NutritionMetricConfiguration[] = [
  { metric: "calories", title: "Calories", unit: "calorie" },
  { metric: "totalFatGrams", title: "Fats", unit: "gram" },
  { metric: "proteinGrams", title: "Protein", unit: "gram" },
  { metric: "totalCarbohydrateGrams", title: "Carbs", unit: "gram" },
];

/** @deprecated Use the shared rolling range helper for new consumers. */
export const getDashboardNutritionDateRange = getRollingSevenDayDateRange;

export function buildDashboardNutritionModels(response: DayLogRangeResponse): DashboardNutritionModels {
  return METRIC_CONFIGURATIONS.reduce<Partial<DashboardNutritionModels>>((models, configuration) => {
    const limit = DAILY_TARGETS[configuration.metric];
    const weeklyData = response.days.map((day) => ({
      label: getLocalWeekdayAbbreviation(day.date),
      eaten: getDayLogNutritionTotals(day.dayLog)[configuration.metric],
      limit,
    }));
    const today = weeklyData[weeklyData.length - 1] ?? { eaten: 0, limit };

    models[configuration.metric] = {
      title: configuration.title,
      unit: configuration.unit,
      today: { eaten: today.eaten, limit: today.limit },
      weeklyData,
    };

    return models;
  }, {}) as DashboardNutritionModels;
}
