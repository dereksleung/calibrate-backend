import type { WeeklyDatum } from "#/shared/components/charts/WeeklyBarChart.tsx";
import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import {
  DAILY_TARGETS,
  getDayLogNutritionTotals,
  type NutritionTotals,
} from "#/shared/nutrition/nutrition-totals.ts";

const DAY_LABELS = ["Sn", "M", "T", "W", "Th", "F", "Sa"] as const;

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

export function getDashboardNutritionDateRange(now = new Date()): { startDate: string; endDate: string } {
  const endDate = formatLocalDate(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);

  return { startDate: formatLocalDate(start), endDate };
}

export function buildDashboardNutritionModels(response: DayLogRangeResponse): DashboardNutritionModels {
  return METRIC_CONFIGURATIONS.reduce<Partial<DashboardNutritionModels>>((models, configuration) => {
    const limit = DAILY_TARGETS[configuration.metric];
    const weeklyData = response.days.map((day) => ({
      label: getDayLabel(day.date),
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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return DAY_LABELS[new Date(year, month - 1, day).getDay()];
}
