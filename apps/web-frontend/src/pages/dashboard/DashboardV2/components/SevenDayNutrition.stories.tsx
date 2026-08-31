import type { SevenDayNutritionRowModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SevenDayNutrition } from "./SevenDayNutrition.tsx";

const labels = ["M", "T", "W", "T", "F", "S", "S"];

const createDays = (amounts: number[]) =>
  amounts.map((amount, index) => ({
    amount,
    date: `2026-08-${String(24 + index).padStart(2, "0")}`,
    label: labels[index],
  }));

const rows: SevenDayNutritionRowModel[] = [
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
];

const meta = {
  title: "Dashboard V2/Seven-day Nutrition",
  component: SevenDayNutrition,
  parameters: { layout: "padded" },
  args: { rows },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[450px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SevenDayNutrition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentDayHighlight: Story = {};
