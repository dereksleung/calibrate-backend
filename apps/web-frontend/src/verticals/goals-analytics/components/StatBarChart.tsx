import type { ReactNode } from "react";

import { cn } from "#/lib/utils.ts";
import { Card, CardContent } from "#/shared/components/base/Card.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "#/shared/components/base/chart.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/shared/components/base/tooltip/Tooltip.tsx";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";

type StatBarChartDatum = {
  label: string;
  limit: number;
  value: number | null;
};

type StatBarChartProps = {
  ariaLabel?: string;
  chartConfig: ChartConfig;
  children: ReactNode;
  data: StatBarChartDatum[];
  onClick?: () => void;
  tooltipContent?: ReactNode;
  valueUnit?: string;
};

export function StatBarChart({
  ariaLabel,
  chartConfig,
  children,
  data,
  onClick,
  tooltipContent,
  valueUnit,
}: StatBarChartProps) {
  const limit = data[0]?.limit ?? 0;
  const maxValue = data.length
    ? Math.max(...data.flatMap(({ value, limit }) => (value === null ? [limit] : [value, limit])))
    : 0;
  const yAxisMax = Math.ceil((maxValue * 1.1) / 10) * 10;

  const chartCard = (
    <Card
      aria-label={ariaLabel}
      className={cn(
        "rounded-[14px] border-white/70 bg-white/60 py-0 shadow-[0_28px_70px_-44px_rgba(0,0,0,0.65)]",
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-4 md:p-8">
        {children}

        <div className="mt-4 min-w-0">
          <ChartContainer config={chartConfig} className={cn("w-full", onClick && "cursor-pointer")}>
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ top: 16, right: 8, left: 8 }}
              responsive
              barCategoryGap="35%"
              className="flex-1"
            >
              <YAxis domain={[0, yAxisMax]} padding={{ top: 8 }} width="auto" />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                tickMargin={16}
                tick={{
                  fill: "var(--color-on-surface)",
                  fontSize: 12,
                  fontWeight: 400,
                }}
                height={48}
              />
              <ChartTooltip
                cursor={{
                  fill: "color-mix(in srgb, var(--color-value) 45%, transparent)",
                }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(_, payload) => payload[0]?.payload?.label ?? ""}
                    formatter={(value, _, item) => {
                      const payload = item.payload as StatBarChartDatum | undefined;
                      const percentOfLimit =
                        payload && payload.value !== null
                          ? Math.round((payload.value / (payload.limit || 1)) * 100)
                          : 0;
                      const unitLabel = valueUnit ?? "";

                      return (
                        <span className="font-medium text-foreground">
                          {Number(value).toFixed(0)}
                          {unitLabel} / {percentOfLimit}% of limit
                        </span>
                      );
                    }}
                  />
                }
              />
              <ReferenceLine
                y={limit}
                stroke="var(--color-limit)"
                strokeDasharray="6 6"
                ifOverflow="extendDomain"
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[16, 16, 16, 16]}
                barSize={30}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );

  if (!tooltipContent) {
    return chartCard;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chartCard}</TooltipTrigger>
      <TooltipContent side="top">{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

export type { StatBarChartDatum };
