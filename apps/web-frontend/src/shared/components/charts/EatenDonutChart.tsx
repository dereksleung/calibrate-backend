import { cn } from "#/lib/utils.ts";
import { ChartContainer, type ChartConfig } from "#/shared/components/base/chart.tsx";
import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

type EatenDonutChartProps = {
  eaten: number;
  limit: number;
  className?: string;
  metricLabel?: string;
};

const chartConfig = {
  eaten: {
    color: "var(--color-primary)",
    label: "Eaten",
  },
  remaining: {
    color: "var(--color-surface-container-low)",
    label: "Remaining",
  },
} satisfies ChartConfig;

const formatEatenChartValue = (value: number) => value.toLocaleString();

export const EatenDonutChart = ({
  eaten,
  limit,
  className,
  metricLabel = "Calories",
}: EatenDonutChartProps) => {
  const uniqueId = React.useId().replace(/:/g, "");
  const gradientId = `${uniqueId}-eaten-gradient`;
  const redGradientId = `${uniqueId}-eaten-over-limit-gradient`;
  const eatenLimitDelta = limit - eaten;
  const isUnderLimit = eatenLimitDelta >= 0;
  const eatenLimitComparisonLabel = isUnderLimit ? "Under" : "Over";
  const eatenLimitComparisonTone = isUnderLimit ? "fill-primary" : "fill-destructive";
  const activeGradientId = isUnderLimit ? gradientId : redGradientId;
  const chartData = [
    {
      name: "eaten",
      value: Math.min(eaten, limit),
      fill: `url(#${activeGradientId})`,
    },
    {
      name: "remaining",
      value: Math.max(eatenLimitDelta, 0),
      fill: "var(--color-remaining)",
    },
  ];

  return (
    <ChartContainer
      aria-label={`${metricLabel} eaten today`}
      config={chartConfig}
      className="aspect-square max-h-full w-full max-w-[17rem]"
    >
      <PieChart
        accessibilityLayer
        responsive
        className={cn("flex-1 min-h-[8rem] md:min-h-[13rem]", className)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-fixed)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
          <linearGradient id={redGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-orange-500)" />
            <stop offset="100%" stopColor="var(--color-red-600)" />
          </linearGradient>
        </defs>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius="74%"
          outerRadius="88%"
          paddingAngle={3}
          cornerRadius={18}
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                return null;
              }

              const centerY = viewBox.cy ?? 0;
              const outerRadius =
                "outerRadius" in viewBox && typeof viewBox.outerRadius === "number"
                  ? viewBox.outerRadius
                  : 118;

              const isCompact = outerRadius < 100;
              const valueYOffset = isCompact ? -4 : 0;
              const labelYOffset = isCompact ? 18 : 28;

              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan
                    x={viewBox.cx}
                    y={centerY + valueYOffset}
                    className={`${eatenLimitComparisonTone} font-heading text-[1.5rem] md:text-[2.5rem] font-light`}
                  >
                    {formatEatenChartValue(Math.abs(eatenLimitDelta))}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={centerY + labelYOffset}
                    className={`${eatenLimitComparisonTone} font-sans relative bottom-5 md:bottom-0 text-[0.6rem] md:text-[0.75rem] font-medium uppercase tracking-[0.22em]`}
                  >
                    {eatenLimitComparisonLabel}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
