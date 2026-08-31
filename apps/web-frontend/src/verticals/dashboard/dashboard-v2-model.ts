import type { DayLogRangeResponse, FoodEntryResponse } from "@calibrate/api-contracts";

import { getLocalWeekdayAbbreviation } from "#/shared/date/local-date-range.ts";
import {
  DAILY_TARGETS,
  getDayLogNutritionTotals,
  type NutritionTotals,
} from "#/shared/nutrition/nutrition-totals.ts";

export type DashboardHistoryDay = DayLogRangeResponse["days"][number];
export type DashboardNutritionMetric = keyof NutritionTotals;
export type ChangeSortDirection = "ascending" | "descending";

type NutrientConfiguration = {
  metric: DashboardNutritionMetric;
  title: "Calories" | "Protein" | "Fats" | "Carbs";
  unit: "kcal" | "g";
};

export type DashboardV2ViewModel = {
  sevenDayNutrition: {
    rows: SevenDayNutritionRowModel[];
  };
  habits: {
    weighIn: HabitCardModel;
    foodLogging: HabitCardModel;
  };
  nutritionCards: Record<DashboardNutritionMetric, NutritionCardModel>;
  analytics: Record<DashboardNutritionMetric, NutrientAnalyticsModel>;
};

export type SevenDayNutritionRowModel = {
  metric: DashboardNutritionMetric;
  title: NutrientConfiguration["title"];
  unit: NutrientConfiguration["unit"];
  target: number;
  days: Array<{
    amount: number;
    date: string;
    label: string;
  }>;
};

export type HabitCardModel = {
  completedCurrentWeek: number;
  days: Array<{
    date: string;
    status: "complete" | "incomplete" | "unavailable";
  }>;
  subtitle: "Last 30 Days";
  title: "Weigh-In" | "Food Logging";
};

export type NutritionCardModel = {
  amount: number;
  metric: DashboardNutritionMetric;
  target: number;
  title: NutrientConfiguration["title"];
  unit: NutrientConfiguration["unit"];
};

export type FoodContribution = {
  amount: number;
  name: string;
  share: number;
};

export type ChangeEntry = {
  amount: number;
  change: "new" | number;
  name: string;
};

export type NutrientAnalyticsModel = {
  change: {
    sections: [
      { entries: ChangeEntry[]; kind: "reductions" },
      { entries: ChangeEntry[]; kind: "increases" },
      { entries: ChangeEntry[]; kind: "newFoods" },
    ];
    showInsufficientHistoryBanner: boolean;
  };
  metric: DashboardNutritionMetric;
  title: NutrientConfiguration["title"];
  total: {
    contributions: FoodContribution[];
    amount: number;
  };
  unit: NutrientConfiguration["unit"];
};

const NUTRIENT_CONFIGURATIONS: readonly NutrientConfiguration[] = [
  { metric: "calories", title: "Calories", unit: "kcal" },
  { metric: "proteinGrams", title: "Protein", unit: "g" },
  { metric: "totalFatGrams", title: "Fats", unit: "g" },
  { metric: "totalCarbohydrateGrams", title: "Carbs", unit: "g" },
];

export function buildDashboardV2ViewModel(response: DayLogRangeResponse): DashboardV2ViewModel {
  const rows = NUTRIENT_CONFIGURATIONS.map((configuration) =>
    buildSevenDayNutritionRow(response.days, configuration),
  );
  const nutritionCards = NUTRIENT_CONFIGURATIONS.reduce<Partial<DashboardV2ViewModel["nutritionCards"]>>(
    (cards, configuration) => {
      const today = rows.find(({ metric }) => metric === configuration.metric)?.days.at(-1)?.amount ?? 0;

      cards[configuration.metric] = {
        amount: today,
        metric: configuration.metric,
        target: DAILY_TARGETS[configuration.metric],
        title: configuration.title,
        unit: configuration.unit,
      };

      return cards;
    },
    {},
  ) as DashboardV2ViewModel["nutritionCards"];

  const analytics = NUTRIENT_CONFIGURATIONS.reduce<Partial<DashboardV2ViewModel["analytics"]>>(
    (models, configuration) => {
      models[configuration.metric] = buildNutrientAnalyticsModel({
        days: response.days,
        endDate: response.endDate,
        metric: configuration.metric,
      });

      return models;
    },
    {},
  ) as DashboardV2ViewModel["analytics"];

  return {
    analytics,
    habits: buildHabitModels(response),
    nutritionCards,
    sevenDayNutrition: { rows },
  };
}

export function buildNutrientAnalyticsModel({
  days,
  endDate,
  metric,
  sortDirection = "ascending",
}: {
  days: readonly DashboardHistoryDay[];
  endDate: string;
  metric: DashboardNutritionMetric;
  sortDirection?: ChangeSortDirection;
}): NutrientAnalyticsModel {
  const configuration = getNutrientConfiguration(metric);
  const totalContributions = collectFoodContributions(days, metric);
  const totalAmount = sumContributions(totalContributions);
  const currentWindowStart = offsetDate(endDate, -13);
  const previousWindowStart = offsetDate(endDate, -27);
  const previousWindowEnd = offsetDate(endDate, -14);
  const currentContributions = collectFoodContributions(
    days.filter(({ date }) => date >= currentWindowStart && date <= endDate),
    metric,
  );
  const previousContributions = collectFoodContributions(
    days.filter(({ date }) => date >= previousWindowStart && date <= previousWindowEnd),
    metric,
  );

  return {
    change: {
      sections: buildChangeSections(currentContributions, previousContributions, sortDirection),
      showInsufficientHistoryBanner: currentContributions.size > 0 && previousContributions.size === 0,
    },
    metric,
    title: configuration.title,
    total: {
      amount: totalAmount,
      contributions: [...totalContributions.entries()]
        .map(([name, amount]) => ({ amount, name, share: totalAmount === 0 ? 0 : amount / totalAmount }))
        .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name)),
    },
    unit: configuration.unit,
  };
}

function buildSevenDayNutritionRow(
  days: readonly DashboardHistoryDay[],
  configuration: NutrientConfiguration,
): SevenDayNutritionRowModel {
  return {
    days: days.map(({ date, dayLog }) => ({
      amount: getDayLogNutritionTotals(dayLog)[configuration.metric],
      date,
      label: getLocalWeekdayAbbreviation(date),
    })),
    metric: configuration.metric,
    target: DAILY_TARGETS[configuration.metric],
    title: configuration.title,
    unit: configuration.unit,
  };
}

function buildHabitModels(response: DayLogRangeResponse): DashboardV2ViewModel["habits"] {
  const firstDate = offsetDate(response.endDate, -29);
  const liveDays = new Map(response.days.map((day) => [day.date, day]));
  const historyDates = Array.from({ length: 30 }, (_, index) => offsetDate(firstDate, index));

  const buildHabit = (
    title: HabitCardModel["title"],
    isComplete: (day: DashboardHistoryDay) => boolean,
  ): HabitCardModel => {
    const days = historyDates.map((date) => {
      const day = liveDays.get(date);

      return {
        date,
        status: day ? (isComplete(day) ? "complete" : "incomplete") : "unavailable",
      } as const;
    });

    return {
      completedCurrentWeek: days.slice(-7).filter(({ status }) => status === "complete").length,
      days,
      subtitle: "Last 30 Days",
      title,
    };
  };

  return {
    foodLogging: buildHabit("Food Logging", (day) => getFoodEntries(day).length > 0),
    weighIn: buildHabit("Weigh-In", (day) => day.dayLog?.weight !== null && day.dayLog?.weight !== undefined),
  };
}

function buildChangeSections(
  current: ReadonlyMap<string, number>,
  previous: ReadonlyMap<string, number>,
  sortDirection: ChangeSortDirection,
): NutrientAnalyticsModel["change"]["sections"] {
  const reductions: ChangeEntry[] = [];
  const increases: ChangeEntry[] = [];
  const newFoods: ChangeEntry[] = [];
  const names = new Set([...current.keys(), ...previous.keys()]);

  for (const name of names) {
    const currentAmount = current.get(name) ?? 0;
    const previousAmount = previous.get(name) ?? 0;

    if (previousAmount === 0 && currentAmount > 0) {
      newFoods.push({ amount: currentAmount, change: "new", name });
      continue;
    }

    if (previousAmount === 0) {
      continue;
    }

    const change = (currentAmount - previousAmount) / previousAmount;

    if (change < 0) {
      reductions.push({ amount: currentAmount, change, name });
    } else if (change > 0) {
      increases.push({ amount: currentAmount, change, name });
    }
  }

  return [
    {
      entries: orderEntries(
        reductions,
        (left, right) => {
          return (left.change as number) - (right.change as number) || left.name.localeCompare(right.name);
        },
        sortDirection,
      ),
      kind: "reductions",
    },
    {
      entries: orderEntries(
        increases,
        (left, right) => {
          return (right.change as number) - (left.change as number) || left.name.localeCompare(right.name);
        },
        sortDirection,
      ),
      kind: "increases",
    },
    {
      entries: orderEntries(
        newFoods,
        (left, right) => right.amount - left.amount || left.name.localeCompare(right.name),
        sortDirection,
      ),
      kind: "newFoods",
    },
  ];
}

function collectFoodContributions(
  days: readonly DashboardHistoryDay[],
  metric: DashboardNutritionMetric,
): Map<string, number> {
  return days.reduce((contributions, day) => {
    for (const entry of getFoodEntries(day)) {
      const amount = entry[metric];

      if (amount > 0) {
        contributions.set(entry.name, (contributions.get(entry.name) ?? 0) + amount);
      }
    }

    return contributions;
  }, new Map<string, number>());
}

function getFoodEntries(day: DashboardHistoryDay): FoodEntryResponse[] {
  const dayLog = day.dayLog;

  return [
    ...(dayLog?.breakfast ?? []),
    ...(dayLog?.lunch ?? []),
    ...(dayLog?.dinner ?? []),
    ...(dayLog?.snacks ?? []),
  ];
}

function getNutrientConfiguration(metric: DashboardNutritionMetric): NutrientConfiguration {
  const configuration = NUTRIENT_CONFIGURATIONS.find((candidate) => candidate.metric === metric);

  if (!configuration) {
    throw new Error(`Unsupported dashboard nutrient metric: ${metric}`);
  }

  return configuration;
}

function offsetDate(date: string, offset: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + offset));

  return result.toISOString().slice(0, 10);
}

function orderEntries(
  entries: ChangeEntry[],
  compare: (left: ChangeEntry, right: ChangeEntry) => number,
  sortDirection: ChangeSortDirection,
): ChangeEntry[] {
  const ordered = [...entries].sort(compare);

  return sortDirection === "ascending" ? ordered : ordered.reverse();
}

function sumContributions(contributions: ReadonlyMap<string, number>): number {
  return [...contributions.values()].reduce((sum, amount) => sum + amount, 0);
}
