import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../styles.css";
import type { WeeklyDatum } from "./WeeklyBarChart";

import { WeeklyBarChart } from "./WeeklyBarChart";

const playgroundWeeklyData: WeeklyDatum[] = [
  { label: "MON", eaten: 1540, limit: 1650 },
  { label: "TUE", eaten: 1600, limit: 1650 },
  { label: "WED", eaten: 1625, limit: 1650 },
  { label: "THU", eaten: 1420, limit: 1650 },
  { label: "FRI", eaten: 2160, limit: 1800 },
  { label: "SAT", eaten: 1160, limit: 1800 },
  { label: "SUN", eaten: 1060, limit: 1800 },
];

const meta = {
  title: "Shared/Charts/WeeklyBarChart",
  component: WeeklyBarChart,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    seriesLabel: {
      control: "text",
    },
  },
  args: {
    weeklyData: playgroundWeeklyData,
    seriesLabel: "Calories",
    className: "aspect-auto h-[17rem] w-full max-w-3xl",
  },
} satisfies Meta<typeof WeeklyBarChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllUnderLimit: Story = {
  args: {
    weeklyData: [
      { label: "MON", eaten: 1000, limit: 2000 },
      { label: "TUE", eaten: 1200, limit: 2000 },
      { label: "WED", eaten: 1500, limit: 2000 },
      { label: "THU", eaten: 900, limit: 2000 },
      { label: "FRI", eaten: 1100, limit: 2000 },
      { label: "SAT", eaten: 1300, limit: 2000 },
      { label: "SUN", eaten: 1400, limit: 2000 },
    ],
  },
};

export const AllOverLimit: Story = {
  args: {
    weeklyData: [
      { label: "MON", eaten: 2100, limit: 2000 },
      { label: "TUE", eaten: 2200, limit: 2000 },
      { label: "WED", eaten: 2300, limit: 2000 },
      { label: "THU", eaten: 2400, limit: 2000 },
      { label: "FRI", eaten: 2500, limit: 2000 },
      { label: "SAT", eaten: 2150, limit: 2000 },
      { label: "SUN", eaten: 2050, limit: 2000 },
    ],
  },
};

export const MixedLimitsPerDay: Story = {
  args: {
    weeklyData: [
      { label: "MON", eaten: 1600, limit: 1650 },
      { label: "TUE", eaten: 1650, limit: 1650 },
      { label: "WED", eaten: 1700, limit: 1650 },
      { label: "THU", eaten: 1400, limit: 1800 },
      { label: "FRI", eaten: 1800, limit: 1800 },
      { label: "SAT", eaten: 900, limit: 2000 },
      { label: "SUN", eaten: 2000, limit: 2000 },
    ],
  },
};
