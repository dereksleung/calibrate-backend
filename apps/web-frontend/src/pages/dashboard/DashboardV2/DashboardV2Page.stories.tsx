import type { DashboardV2ViewModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { getLocalWeekdayAbbreviation } from "#/shared/date/local-date-range.ts";

import "../../../styles.css";
import { DashboardV2Page } from "./DashboardV2Page.tsx";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const createDays = (amounts: number[]) => {
  const today = new Date();

  return amounts.map((amount, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    const dateString = formatLocalDate(date);

    return { amount, date: dateString, label: getLocalWeekdayAbbreviation(dateString) };
  });
};

const createHabitHistory = (completedIndexes: number[]) =>
  Array.from({ length: 30 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    status: completedIndexes.includes(index) ? ("complete" as const) : ("unavailable" as const),
  }));

const viewModel: DashboardV2ViewModel = {
  sevenDayNutrition: {
    rows: [
      {
        metric: "calories",
        title: "Calories",
        unit: "kcal",
        target: 1800,
        days: createDays([1120, 980, 1420, 1280, 1661, 850, 661]),
      },
      {
        metric: "proteinGrams",
        title: "Protein",
        unit: "g",
        target: 120,
        days: createDays([72, 58, 89, 66, 94, 54, 55.5]),
      },
      {
        metric: "totalFatGrams",
        title: "Fats",
        unit: "g",
        target: 60,
        days: createDays([21, 17, 29, 22, 27, 16, 16.8]),
      },
      {
        metric: "totalCarbohydrateGrams",
        title: "Carbs",
        unit: "g",
        target: 220,
        days: createDays([118, 94, 141, 109, 135, 77, 70.8]),
      },
    ],
  },
  habits: {
    weighIn: {
      title: "Weighing",
      subtitle: "Last 30 Days",
      completedCurrentWeek: 2,
      days: createHabitHistory([28, 29]),
    },
    foodLogging: {
      title: "Food Logs",
      subtitle: "Last 30 Days",
      completedCurrentWeek: 5,
      days: createHabitHistory([25, 26, 27, 28, 29]),
    },
  },
  nutritionCards: {
    calories: { amount: 661, metric: "calories", target: 1800, title: "Calories", unit: "kcal" },
    proteinGrams: { amount: 55.5, metric: "proteinGrams", target: 120, title: "Protein", unit: "g" },
    totalFatGrams: { amount: 16.8, metric: "totalFatGrams", target: 60, title: "Fats", unit: "g" },
    totalCarbohydrateGrams: {
      amount: 70.8,
      metric: "totalCarbohydrateGrams",
      target: 220,
      title: "Carbs",
      unit: "g",
    },
  },
  analytics: {
    calories: {} as DashboardV2ViewModel["analytics"]["calories"],
    proteinGrams: {} as DashboardV2ViewModel["analytics"]["proteinGrams"],
    totalFatGrams: {} as DashboardV2ViewModel["analytics"]["totalFatGrams"],
    totalCarbohydrateGrams: {} as DashboardV2ViewModel["analytics"]["totalCarbohydrateGrams"],
  },
};

const meta = {
  title: "Dashboard V2/Page",
  component: DashboardV2Page,
  parameters: { layout: "fullscreen" },
  args: {
    onOpenNutrientAnalytics: () => undefined,
    viewModel,
  },
} satisfies Meta<typeof DashboardV2Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
