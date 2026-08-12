// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardNutritionCardModel } from "../dashboard-nutrition-model.ts";

import { TodayAndWeekCalories } from "./TodayAndWeekCalories.tsx";
import { TodayAndWeekStat } from "./TodayAndWeekStat.tsx";

vi.mock("#/shared/components/charts/EatenDonutChart.tsx", () => ({
  EatenDonutChart: ({
    eaten,
    limit,
    metricLabel,
  }: {
    eaten: number;
    limit: number;
    metricLabel?: string;
  }) => (
    <div data-eaten={eaten} data-limit={limit} data-testid={`donut-chart-${metricLabel ?? "Calories"}`} />
  ),
}));

vi.mock("#/shared/components/charts/WeeklyBarChart.tsx", () => ({
  WeeklyBarChart: ({
    seriesLabel,
    weeklyData,
  }: {
    seriesLabel?: string;
    weeklyData: Array<{ eaten: number }>;
  }) => (
    <div
      data-eaten={weeklyData.map((day) => day.eaten).join(",")}
      data-testid={`weekly-chart-${seriesLabel ?? "Calories"}`}
    />
  ),
}));

const caloriesModel: DashboardNutritionCardModel = {
  title: "Calories",
  unit: "calorie",
  today: { eaten: 425, limit: 1800 },
  weeklyData: [
    { label: "M", eaten: 100, limit: 1800 },
    { label: "T", eaten: 0, limit: 1800 },
    { label: "W", eaten: 0, limit: 1800 },
    { label: "Th", eaten: 0, limit: 1800 },
    { label: "F", eaten: 0, limit: 1800 },
    { label: "Sa", eaten: 0, limit: 1800 },
    { label: "Sn", eaten: 425, limit: 1800 },
  ],
};

const fatsModel: DashboardNutritionCardModel = {
  title: "Fats",
  unit: "gram",
  today: { eaten: 11, limit: 60 },
  weeklyData: [
    { label: "M", eaten: 2, limit: 60 },
    { label: "T", eaten: 0, limit: 60 },
    { label: "W", eaten: 0, limit: 60 },
    { label: "Th", eaten: 0, limit: 60 },
    { label: "F", eaten: 0, limit: 60 },
    { label: "Sa", eaten: 0, limit: 60 },
    { label: "Sn", eaten: 11, limit: 60 },
  ],
};

afterEach(() => {
  cleanup();
});

describe("dashboard day and week stats accessibility", () => {
  it("exposes calories chart data as text and a table", () => {
    render(<TodayAndWeekCalories model={caloriesModel} />);

    const card = screen.getByRole("region", { name: "Calories" });
    expect(within(card).getByText(/425 calories eaten out of a 1,800 calorie limit/)).toBeTruthy();

    const table = within(card).getByRole("table", {
      name: "Weekly calories eaten and limits",
    });
    expect(within(table).getByRole("columnheader", { name: "Day" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Eaten" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Limit" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "425 calories" })).toBeTruthy();
    expect(screen.getByTestId("donut-chart-Calories").getAttribute("data-eaten")).toBe("425");
    expect(screen.getByTestId("weekly-chart-Calories").getAttribute("data-eaten")).toBe("100,0,0,0,0,0,425");
  });

  it("labels macro chart summaries with the requested stat", () => {
    render(<TodayAndWeekStat model={fatsModel} />);

    const card = screen.getByRole("region", { name: "Fats" });
    expect(within(card).getByText(/11 grams of fats eaten out of a 60 gram limit/)).toBeTruthy();
    expect(
      within(card).getByRole("table", {
        name: "Weekly fats eaten and limits",
      }),
    ).toBeTruthy();
    expect(screen.getByTestId("donut-chart-Fats")).toBeTruthy();
    expect(screen.getByTestId("weekly-chart-Fats")).toBeTruthy();
    expect(screen.getByTestId("donut-chart-Fats").getAttribute("data-eaten")).toBe("11");
    expect(screen.getByTestId("weekly-chart-Fats").getAttribute("data-eaten")).toBe("2,0,0,0,0,0,11");
  });
});
