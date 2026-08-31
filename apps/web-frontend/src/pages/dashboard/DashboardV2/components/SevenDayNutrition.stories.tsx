import type { SevenDayNutritionRowModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { getLocalWeekdayAbbreviation } from "#/shared/date/local-date-range.ts";

import { SevenDayNutrition } from "./SevenDayNutrition.tsx";

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
