import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../styles.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
  title: "Shared/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[min(22rem,calc(100vw-2rem))] font-sans">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SegmentedControl: Story = {
  render: () => (
    <Tabs defaultValue="sign-in">
      <TabsList aria-label="Authentication method">
        <TabsTrigger value="sign-in">Sign In</TabsTrigger>
        <TabsTrigger value="create-account">Create Account</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4 text-on-surface-variant" value="sign-in">
        Welcome back. Sign in to continue your food log.
      </TabsContent>
      <TabsContent className="pt-4 text-on-surface-variant" value="create-account">
        Create an account to start tracking your progress.
      </TabsContent>
    </Tabs>
  ),
};

export const ThreeOptions: Story = {
  render: () => (
    <Tabs defaultValue="day">
      <TabsList aria-label="Nutrition summary period">
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4 text-on-surface-variant" value="day">
        Today&apos;s nutrition summary
      </TabsContent>
      <TabsContent className="pt-4 text-on-surface-variant" value="week">
        This week&apos;s nutrition summary
      </TabsContent>
      <TabsContent className="pt-4 text-on-surface-variant" value="month">
        This month&apos;s nutrition summary
      </TabsContent>
    </Tabs>
  ),
};

export const Line: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Progress section" variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4 text-on-surface-variant" value="overview">
        Your latest progress at a glance.
      </TabsContent>
      <TabsContent className="pt-4 text-on-surface-variant" value="history">
        Your progress over time.
      </TabsContent>
    </Tabs>
  ),
};

export const WithDisabledOption: Story = {
  render: () => (
    <Tabs defaultValue="daily">
      <TabsList aria-label="Report frequency">
        <TabsTrigger value="daily">Daily</TabsTrigger>
        <TabsTrigger value="weekly">Weekly</TabsTrigger>
        <TabsTrigger disabled value="yearly">
          Yearly
        </TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4 text-on-surface-variant" value="daily">
        Daily report
      </TabsContent>
      <TabsContent className="pt-4 text-on-surface-variant" value="weekly">
        Weekly report
      </TabsContent>
    </Tabs>
  ),
};
