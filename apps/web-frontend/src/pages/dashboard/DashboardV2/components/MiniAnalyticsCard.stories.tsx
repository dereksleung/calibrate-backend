import type { Meta, StoryObj } from "@storybook/react-vite";

import { MiniAnalyticsCard } from "./MiniAnalyticsCard.tsx";

const meta = {
  title: "Dashboard V2/Mini Analytics Card",
  component: MiniAnalyticsCard,
  parameters: { layout: "padded" },
  args: { title: "Protein" },
} satisfies Meta<typeof MiniAnalyticsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveNutritionSummary: Story = {
  render: (args) => (
    <div className="w-52">
      <MiniAnalyticsCard {...args}>
        <MiniAnalyticsCard.Title>Protein</MiniAnalyticsCard.Title>
        <MiniAnalyticsCard.Subtitle>Today</MiniAnalyticsCard.Subtitle>
        <MiniAnalyticsCard.ChartArea className="mt-5">
          <div className="relative h-2 rounded-full bg-black/[0.055]">
            <span className="absolute inset-y-0 left-0 w-[44%] rounded-full bg-protein-vibrant-rose" />
            <span className="absolute -top-0.5 bottom-[-0.125rem] left-[80%] w-0.5 rounded-full bg-on-surface-variant/70" />
          </div>
        </MiniAnalyticsCard.ChartArea>
        <MiniAnalyticsCard.Separator className="my-4" />
        <MiniAnalyticsCard.BottomSummary
          accessibleName="Open Protein analytics"
          interactive
          onClick={() => undefined}
        >
          <span className="flex items-baseline gap-1">
            <MiniAnalyticsCard.SummaryStat>55.5</MiniAnalyticsCard.SummaryStat>
            <span className="text-xs text-on-surface-variant">g</span>
          </span>
        </MiniAnalyticsCard.BottomSummary>
      </MiniAnalyticsCard>
    </div>
  ),
};

export const StaticHabitSummary: Story = {
  args: { title: "Weighing" },
  render: (args) => (
    <div className="w-52">
      <MiniAnalyticsCard {...args}>
        <MiniAnalyticsCard.Title>Weighing</MiniAnalyticsCard.Title>
        <MiniAnalyticsCard.Subtitle>Last 30 Days</MiniAnalyticsCard.Subtitle>
        <MiniAnalyticsCard.ChartArea className="mt-4 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 30 }, (_, index) => (
            <span
              className={
                index >= 28
                  ? "aspect-square rounded-sm bg-primary"
                  : "aspect-square rounded-sm bg-black/[0.055]"
              }
              key={index}
            />
          ))}
        </MiniAnalyticsCard.ChartArea>
        <MiniAnalyticsCard.Separator className="my-4" />
        <MiniAnalyticsCard.BottomSummary interactive={false}>
          <span className="flex items-baseline gap-1.5">
            <MiniAnalyticsCard.SummaryStat>2/7</MiniAnalyticsCard.SummaryStat>
            <span className="text-xs text-on-surface-variant">this week</span>
          </span>
        </MiniAnalyticsCard.BottomSummary>
      </MiniAnalyticsCard>
    </div>
  ),
};
