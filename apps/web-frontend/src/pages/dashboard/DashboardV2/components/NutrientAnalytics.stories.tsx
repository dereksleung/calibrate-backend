import type { NutrientAnalyticsModel } from "#/verticals/dashboard/dashboard-v2-model.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../../styles.css";
import { NutrientAnalytics } from "./NutrientAnalytics.tsx";

function buildModel(
  overrides: Pick<NutrientAnalyticsModel, "metric" | "title" | "unit"> & Partial<NutrientAnalyticsModel>,
): NutrientAnalyticsModel {
  return {
    total: {
      amount: 150,
      contributions: [
        { amount: 90, name: "Tofu, Extra Firm", share: 0.6 },
        { amount: 60, name: "Oats, Organic", share: 0.4 },
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

const calories = buildModel({
  metric: "calories",
  title: "Calories",
  unit: "kcal",
  total: {
    amount: 1247,
    contributions: [
      { amount: 620, name: "Tofu, Extra Firm", share: 0.497 },
      { amount: 390, name: "Oats, Organic", share: 0.313 },
      { amount: 237, name: "Oat Milk", share: 0.19 },
    ],
  },
});

const protein = buildModel({
  metric: "proteinGrams",
  title: "Protein",
  unit: "g",
  total: {
    amount: 88,
    contributions: [
      { amount: 46, name: "Tofu, Extra Firm", share: 0.523 },
      { amount: 28, name: "Greek Yogurt", share: 0.318 },
      { amount: 14, name: "Oats, Organic", share: 0.159 },
    ],
  },
});

const fats = buildModel({
  metric: "totalFatGrams",
  title: "Fats",
  unit: "g",
  total: {
    amount: 42,
    contributions: [
      { amount: 24, name: "Tofu, Extra Firm", share: 0.571 },
      { amount: 11, name: "Almond Butter", share: 0.262 },
      { amount: 7, name: "Oat Milk", share: 0.167 },
    ],
  },
});

const carbs = buildModel({
  metric: "totalCarbohydrateGrams",
  title: "Carbs",
  unit: "g",
  total: {
    amount: 186,
    contributions: [
      { amount: 92, name: "Oats, Organic", share: 0.495 },
      { amount: 58, name: "Pineapple", share: 0.312 },
      { amount: 36, name: "Oat Milk", share: 0.194 },
    ],
  },
});

const populatedChange = {
  showInsufficientHistoryBanner: false,
  sections: {
    reductions: [
      { amount: 0, change: -1, name: "Crackers" },
      { amount: 50, change: -0.5, name: "Tofu, Extra Firm" },
    ],
    increases: [
      { amount: 100, change: 1, name: "Rice" },
      { amount: 30, change: 0.5, name: "Oat Milk" },
    ],
    newFoods: [
      { amount: 40, change: "new" as const, name: "Berries" },
      { amount: 20, change: "new" as const, name: "Yogurt" },
    ],
  },
};

const meta = {
  title: "Dashboard V2/Nutrient Analytics",
  component: NutrientAnalytics,
  parameters: { layout: "centered" },
  args: {
    model: calories,
  },
  decorators: [
    (Story) => (
      <div className="h-[42rem] w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NutrientAnalytics>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CaloriesTotal: Story = {};

export const ProteinTotal: Story = {
  args: { model: protein },
};

export const FatsTotal: Story = {
  args: { model: fats },
};

export const CarbsTotal: Story = {
  args: { model: carbs },
};

export const ChangeProvisionalAllNew: Story = {
  args: {
    defaultTab: "change",
    model: {
      ...calories,
      change: {
        showInsufficientHistoryBanner: true,
        sections: {
          reductions: [],
          increases: [],
          newFoods: calories.total.contributions.map((contribution) => ({
            amount: contribution.amount,
            change: "new" as const,
            name: contribution.name,
          })),
        },
      },
    },
  },
};

export const ChangePopulatedSections: Story = {
  args: {
    defaultTab: "change",
    model: {
      ...calories,
      change: populatedChange,
    },
  },
};

export const ChangeEmptySections: Story = {
  args: {
    defaultTab: "change",
    model: calories,
  },
};
