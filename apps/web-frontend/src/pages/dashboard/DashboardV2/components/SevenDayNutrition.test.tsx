// @vitest-environment jsdom

import type { SevenDayNutritionRowModel } from "#/verticals/dashboard/dashboard-v2-model.ts";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SevenDaySummaryStat } from "./SevenDayNutrition.tsx";

const caloriesRow: SevenDayNutritionRowModel = {
  days: [
    { amount: 300, date: "2026-08-24", hasData: true, label: "M" },
    { amount: 0, date: "2026-08-25", hasData: false, label: "T" },
    { amount: 450, date: "2026-08-26", hasData: true, label: "W" },
    { amount: 0, date: "2026-08-27", hasData: false, label: "Th" },
    { amount: 600, date: "2026-08-28", hasData: true, label: "F" },
    { amount: 0, date: "2026-08-29", hasData: false, label: "Sa" },
    { amount: 0, date: "2026-08-30", hasData: false, label: "Sn" },
  ],
  metric: "calories",
  target: 1800,
  title: "Calories",
  unit: "kcal",
};

afterEach(cleanup);

describe("SevenDaySummaryStat", () => {
  it("averages only days with logged nutrition", () => {
    render(<SevenDaySummaryStat row={caloriesRow} />);

    expect(screen.getByText("450")).toBeTruthy();
  });

  it("shows zero when no days have logged nutrition", () => {
    render(
      <SevenDaySummaryStat
        row={{
          ...caloriesRow,
          days: caloriesRow.days.map((day) => ({ ...day, amount: 0, hasData: false })),
        }}
      />,
    );

    expect(screen.getByText("0")).toBeTruthy();
  });
});
