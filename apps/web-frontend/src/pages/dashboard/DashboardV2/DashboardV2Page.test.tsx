// @vitest-environment jsdom

import type {
  DashboardV2ViewModel,
  NutrientAnalyticsModel,
} from "#/verticals/dashboard/dashboard-v2-model.ts";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardV2Page } from "./DashboardV2Page.tsx";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
}));

function analyticsModel(
  metric: NutrientAnalyticsModel["metric"],
  title: NutrientAnalyticsModel["title"],
  unit: NutrientAnalyticsModel["unit"],
): NutrientAnalyticsModel {
  return {
    metric,
    title,
    unit,
    total: {
      amount: unit === "kcal" ? 150 : 40,
      contributions: [{ amount: unit === "kcal" ? 150 : 40, name: `${title} food`, share: 1 }],
    },
    change: {
      showInsufficientHistoryBanner: true,
      sections: {
        reductions: [],
        increases: [],
        newFoods: [{ amount: unit === "kcal" ? 150 : 40, change: "new", name: `${title} food` }],
      },
    },
  };
}

const viewModel: DashboardV2ViewModel = {
  sevenDayNutrition: {
    rows: [
      {
        metric: "calories",
        title: "Calories",
        unit: "kcal",
        target: 1800,
        days: [
          { amount: 1120, date: "2026-08-24", label: "M" },
          { amount: 980, date: "2026-08-25", label: "T" },
          { amount: 1420, date: "2026-08-26", label: "W" },
          { amount: 1280, date: "2026-08-27", label: "T" },
          { amount: 1661, date: "2026-08-28", label: "F" },
          { amount: 850, date: "2026-08-29", label: "S" },
          { amount: 661, date: "2026-08-30", label: "S" },
        ],
      },
      {
        metric: "proteinGrams",
        title: "Protein",
        unit: "g",
        target: 120,
        days: [
          { amount: 72, date: "2026-08-24", label: "M" },
          { amount: 58, date: "2026-08-25", label: "T" },
          { amount: 89, date: "2026-08-26", label: "W" },
          { amount: 66, date: "2026-08-27", label: "T" },
          { amount: 94, date: "2026-08-28", label: "F" },
          { amount: 54, date: "2026-08-29", label: "S" },
          { amount: 55.5, date: "2026-08-30", label: "S" },
        ],
      },
      {
        metric: "totalFatGrams",
        title: "Fats",
        unit: "g",
        target: 60,
        days: Array.from({ length: 7 }, (_, index) => ({
          amount: 17 + index,
          date: `2026-08-${String(24 + index).padStart(2, "0")}`,
          label: ["M", "T", "W", "T", "F", "S", "S"][index] as string,
        })),
      },
      {
        metric: "totalCarbohydrateGrams",
        title: "Carbs",
        unit: "g",
        target: 220,
        days: Array.from({ length: 7 }, (_, index) => ({
          amount: 71 + index,
          date: `2026-08-${String(24 + index).padStart(2, "0")}`,
          label: ["M", "T", "W", "T", "F", "S", "S"][index] as string,
        })),
      },
    ],
  },
  habits: {
    weighIn: {
      title: "Weighing",
      subtitle: "Last 30 Days",
      completedCurrentWeek: 2,
      days: Array.from({ length: 30 }, (_, index) => ({
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        status: index >= 28 ? "complete" : "unavailable",
      })),
    },
    foodLogging: {
      title: "Food Logs",
      subtitle: "Last 30 Days",
      completedCurrentWeek: 5,
      days: Array.from({ length: 30 }, (_, index) => ({
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        status: index >= 25 ? "complete" : "unavailable",
      })),
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
    calories: analyticsModel("calories", "Calories", "kcal"),
    proteinGrams: analyticsModel("proteinGrams", "Protein", "g"),
    totalFatGrams: analyticsModel("totalFatGrams", "Fats", "g"),
    totalCarbohydrateGrams: analyticsModel("totalCarbohydrateGrams", "Carbs", "g"),
  },
};

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
});

describe("DashboardV2Page", () => {
  it("renders the required heading hierarchy and titled chart cards", () => {
    render(<DashboardV2Page viewModel={viewModel} />);

    expect(screen.getByRole("heading", { level: 2, name: "Seven-day nutrition" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Habits" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Nutrition" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.getByRole("region", { name: "Seven-day nutrition overview" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Weighing" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Calories" })).toBeTruthy();
  });

  it("opens the selected nutrient drawer from the nutrition summary button", () => {
    render(<DashboardV2Page viewModel={viewModel} />);

    expect(within(screen.getByTestId("nutrition-card-grid")).getAllByRole("button")).toHaveLength(4);
    expect(within(screen.getByRole("region", { name: "Weighing" })).queryByRole("button")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open Calories analytics" }));

    expect(screen.getByRole("dialog", { name: "Calories analytics" })).toBeTruthy();
    expect(screen.getByText("Calories food")).toBeTruthy();
    expect(screen.getByText("150 kcal")).toBeTruthy();
  });

  it("restores focus to the BottomSummary button when the drawer closes", async () => {
    render(<DashboardV2Page viewModel={viewModel} />);

    const caloriesButton = screen.getByRole("button", { name: "Open Calories analytics" });
    caloriesButton.focus();
    fireEvent.click(caloriesButton);

    expect(screen.getByRole("dialog", { name: "Calories analytics" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Calories analytics" })).toBeNull();
    });
    expect(document.activeElement).toBe(caloriesButton);
  });

  it("provides the seven-day chart values as an accessible static table", () => {
    render(<DashboardV2Page viewModel={viewModel} />);

    const table = screen.getByRole("table", { name: "Seven-day nutrition summary" });
    expect(within(table).getByRole("columnheader", { name: "Metric" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "661 kcal" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "55.5 g" })).toBeTruthy();
  });

  it("keeps both mini-card groups in two columns at the narrowest viewport", () => {
    render(<DashboardV2Page viewModel={viewModel} />);

    expect(screen.getByTestId("habit-card-grid").className).toContain("grid-cols-2");
    expect(screen.getByTestId("nutrition-card-grid").className).toContain("grid-cols-2");
    expect(
      screen.getByRole("table", { name: "Seven-day nutrition summary" }).parentElement?.className,
    ).toContain("sr-only");
  });
});
