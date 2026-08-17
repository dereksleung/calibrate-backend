import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../styles.css";
import { EatenDonutChart } from "./EatenDonutChart";

const meta = {
  title: "Shared/Charts/EatenDonutChart",
  component: EatenDonutChart,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    eaten: {
      control: "number",
    },
    limit: {
      control: "number",
    },
  },
  args: {
    eaten: 1500,
    limit: 2000,
  },
} satisfies Meta<typeof EatenDonutChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const UnderLimit: Story = {
  args: {
    eaten: 1500,
    limit: 2000,
  },
};

export const AtLimit: Story = {
  args: {
    eaten: 2000,
    limit: 2000,
  },
};

export const OverLimit: Story = {
  args: {
    eaten: 2500,
    limit: 2000,
  },
};

export const LargeNumbers: Story = {
  args: {
    eaten: 1_234_567,
    limit: 2_000_000,
  },
};
