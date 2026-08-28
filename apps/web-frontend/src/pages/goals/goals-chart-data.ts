import type { DayLogRangeResponse } from "@calibrate/api-contracts";

import { getLocalWeekdayAbbreviation } from "#/shared/date/local-date-range.ts";
import { DAILY_TARGETS, getDayLogNutritionTotals } from "#/shared/nutrition/nutrition-totals.ts";

export type GoalsWeightChartDatum = {
  date: string;
  label: string;
  weight: number | null;
};

export type GoalsFatChartDatum = {
  date: string;
  eaten: number | null;
  label: string;
  limit: number;
};

export type GoalsChartData = {
  fat: GoalsFatChartDatum[];
  weight: GoalsWeightChartDatum[];
  weightChange: number | null;
};

export function buildGoalsChartData(response: DayLogRangeResponse): GoalsChartData {
  const weight = response.days.map<GoalsWeightChartDatum>((day) => ({
    date: day.date,
    label: getLocalWeekdayAbbreviation(day.date),
    weight: day.dayLog?.weight ?? null,
  }));
  const fat = response.days.map<GoalsFatChartDatum>((day) => ({
    date: day.date,
    eaten: day.dayLog ? getDayLogNutritionTotals(day.dayLog).totalFatGrams : null,
    label: getLocalWeekdayAbbreviation(day.date),
    limit: DAILY_TARGETS.totalFatGrams,
  }));
  const observedWeights = weight.filter(({ weight: value }) => value !== null);

  return {
    fat,
    weight,
    weightChange:
      observedWeights.length >= 2
        ? observedWeights[observedWeights.length - 1].weight! - observedWeights[0].weight!
        : null,
  };
}
