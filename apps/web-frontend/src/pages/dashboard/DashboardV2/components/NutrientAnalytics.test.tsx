// @vitest-environment jsdom

import type { ChangeEntry, NutrientAnalyticsModel } from "#/verticals/dashboard/dashboard-v2-model.ts";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NutrientAnalytics } from "./NutrientAnalytics.tsx";

afterEach(() => {
  cleanup();
});

function buildModel(overrides: Partial<NutrientAnalyticsModel> = {}): NutrientAnalyticsModel {
  return {
    metric: "calories",
    title: "Calories",
    unit: "kcal",
    total: {
      amount: 150,
      contributions: [
        { amount: 90, name: "Tofu", share: 0.6 },
        { amount: 60, name: "Oats", share: 0.4 },
      ],
    },
    change: {
      showInsufficientHistoryBanner: false,
      sections: {
        reductions: [],
        increases: [],
        newFoods: [],
      },
    },
    ...overrides,
  };
}

const populatedChangeSections = {
  reductions: [
    { amount: 0, change: -1, name: "Crackers" },
    { amount: 50, change: -0.5, name: "Tofu" },
  ] satisfies ChangeEntry[],
  increases: [
    { amount: 100, change: 1, name: "Rice" },
    { amount: 30, change: 0.5, name: "Eggs" },
  ] satisfies ChangeEntry[],
  newFoods: [
    { amount: 40, change: "new", name: "Berries" },
    { amount: 20, change: "new", name: "Yogurt" },
  ] satisfies ChangeEntry[],
};

function namesInRegion(name: string) {
  return within(screen.getByRole("region", { name }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("NutrientAnalytics", () => {
  it.each([
    {
      amount: 150,
      metric: "calories" as const,
      title: "Calories" as const,
      unit: "kcal" as const,
    },
    {
      amount: 55.5,
      metric: "proteinGrams" as const,
      title: "Protein" as const,
      unit: "g" as const,
    },
    {
      amount: 16.8,
      metric: "totalFatGrams" as const,
      title: "Fats" as const,
      unit: "g" as const,
    },
    {
      amount: 70.8,
      metric: "totalCarbohydrateGrams" as const,
      title: "Carbs" as const,
      unit: "g" as const,
    },
  ])("renders the $title label and $unit amounts", ({ amount, metric, title, unit }) => {
    render(
      <NutrientAnalytics
        model={buildModel({
          metric,
          title,
          unit,
          total: {
            amount,
            contributions: [{ amount, name: "Oats", share: 1 }],
          },
        })}
      />,
    );

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(`${amount} ${unit}`, { selector: "p" })).toBeTruthy();
    expect(screen.getByText(`Total ${title} by food for last 7 days`)).toBeTruthy();
  });

  it("lists total contributions in descending amount order with shares and no images", () => {
    const { container } = render(<NutrientAnalytics model={buildModel()} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Tofu");
    expect(items[0]?.textContent).toContain("90 kcal");
    expect(items[0]?.textContent).toContain("60%");
    expect(items[1]?.textContent).toContain("Oats");
    expect(items[1]?.textContent).toContain("60 kcal");
    expect(items[1]?.textContent).toContain("40%");
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("keeps the selected nutrient while switching between Total and Change tabs", () => {
    render(<NutrientAnalytics model={buildModel()} />);

    expect(screen.getByRole("tab", { name: "Total" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Change" }));

    expect(screen.getByRole("tab", { name: "Change" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Food contribution change" })).toBeTruthy();
    expect(screen.getByText("Compares the most recent two weeks with the two weeks before.")).toBeTruthy();
    expect(screen.getByText("Calories")).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).not.toContain("Tofu");
  });

  it("shows the seven-day-safe banner and all-New rows for provisional history", () => {
    const { container } = render(
      <NutrientAnalytics
        defaultTab="change"
        model={buildModel({
          change: {
            showInsufficientHistoryBanner: true,
            sections: {
              reductions: [],
              increases: [],
              newFoods: [
                { amount: 100, change: "new", name: "Tofu" },
                { amount: 60, change: "new", name: "Pineapple" },
              ],
            },
          },
        })}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "More history is needed to compare changes. Foods logged in the last 7 days are shown as New.",
    );
    expect(namesInRegion("New Foods")).toEqual([
      expect.stringContaining("Tofu"),
      expect.stringContaining("Pineapple"),
    ]);
    expect(screen.getByText("100 kcal")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "New Foods" })).getAllByText("New")).toHaveLength(2);
    expect(
      within(screen.getByRole("region", { name: "Reductions" })).getByText("No reductions"),
    ).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders Change sections in order with grouped rows and empty states", () => {
    render(
      <NutrientAnalytics
        defaultTab="change"
        model={buildModel({
          change: {
            showInsufficientHistoryBanner: false,
            sections: populatedChangeSections,
          },
        })}
      />,
    );

    const reductions = screen.getByRole("region", { name: "Reductions" });
    const increases = screen.getByRole("region", { name: "Increases" });
    const newFoods = screen.getByRole("region", { name: "New Foods" });

    expect(reductions.compareDocumentPosition(increases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(increases.compareDocumentPosition(newFoods) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(reductions).getByText("-100%")).toBeTruthy();
    expect(within(reductions).getByText("-50%")).toBeTruthy();
    expect(within(increases).getByText("+100%")).toBeTruthy();
    expect(within(newFoods).getByText("40 kcal")).toBeTruthy();
    expect(within(newFoods).getAllByText("New")).toHaveLength(2);
  });

  it("shows concise empty states when a Change section has no rows", () => {
    render(<NutrientAnalytics defaultTab="change" model={buildModel()} />);

    expect(
      within(screen.getByRole("region", { name: "Reductions" })).getByText("No reductions"),
    ).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Increases" })).getByText("No increases")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "New Foods" })).getByText("No new foods")).toBeTruthy();
  });

  it("reverses every Change section from one accessible sorting control", () => {
    render(
      <NutrientAnalytics
        defaultTab="change"
        model={buildModel({
          change: {
            showInsufficientHistoryBanner: false,
            sections: populatedChangeSections,
          },
        })}
      />,
    );

    const sortControl = screen.getByRole("button", { name: "Reverse contribution change order" });
    expect(sortControl.getAttribute("aria-pressed")).toBe("false");
    expect(namesInRegion("Reductions")[0]).toContain("Crackers");
    expect(namesInRegion("Increases")[0]).toContain("Rice");
    expect(namesInRegion("New Foods")[0]).toContain("Berries");

    fireEvent.click(sortControl);

    expect(sortControl.getAttribute("aria-pressed")).toBe("true");
    expect(namesInRegion("Reductions")[0]).toContain("Tofu");
    expect(namesInRegion("Increases")[0]).toContain("Eggs");
    expect(namesInRegion("New Foods")[0]).toContain("Yogurt");
  });
});
