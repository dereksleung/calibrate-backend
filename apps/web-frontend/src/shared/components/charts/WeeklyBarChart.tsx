import { cn } from "#/lib/utils.ts";
import { ChartContainer, type ChartConfig } from "#/shared/components/base/chart.tsx";
import { useIsMobile } from "#/shared/hooks/use-media-query";
import { Bar, BarChart, XAxis } from "recharts";

const Y_AXIS_PADDING = 1.1;

export type WeeklyDatum = {
  label: string;
  eaten: number;
  limit: number;
};

type WeeklyBarChartProps = {
  weeklyData: WeeklyDatum[];
  className?: string;
  seriesLabel?: string;
};

type EatenLimitBarShapeProps = {
  background?: {
    y?: number;
    height?: number;
  };
  height?: number;
  payload?: WeeklyDatum;
  width?: number;
  x?: number;
  y?: number;
  yAxisMax: number;
};

export const EatenLimitBarShape = ({
  background,
  height = 0,
  payload,
  width = 0,
  x = 0,
  y = 0,
  yAxisMax,
}: EatenLimitBarShapeProps) => {
  if (!payload) {
    return null;
  }
  const fullBarHeight = background?.height ?? height;
  const fullBarY = background?.y ?? y;
  const limitY = fullBarY + fullBarHeight * (1 - payload.limit / yAxisMax);
  const isOverLimit = payload.eaten > payload.limit;
  const fill = isOverLimit ? "var(--color-red-600)" : "var(--color-primary-fixed)";

  return (
    <g>
      <rect x={x - width / 2} y={y} width={width * 2} height={height} rx={width} fill={fill} />
      {isOverLimit ? (
        <>
          <line
            x1={x}
            x2={x + width * 2}
            y1={limitY}
            y2={limitY}
            stroke="rgba(255, 255, 255, 0.92)"
            strokeLinecap="round"
            strokeWidth={2}
            transform={`translate(${-width / 2}, 0)`}
          />
        </>
      ) : null}
    </g>
  );
};

export const WeeklyBarChart = ({ weeklyData, className, seriesLabel = "Calories" }: WeeklyBarChartProps) => {
  const maxValue = weeklyData.length
    ? Math.max(...weeklyData.flatMap(({ eaten, limit }) => [eaten, limit]))
    : 0;
  const yAxisMax = maxValue * Y_AXIS_PADDING;

  const chartConfig = {
    eaten: {
      label: seriesLabel,
    },
  } satisfies ChartConfig;

  const isMobile = useIsMobile();

  return (
    <ChartContainer aria-label={`Weekly ${seriesLabel.toLowerCase()} eaten and limits`} config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={weeklyData}
        barCategoryGap="35%"
        className={cn("flex-1 min-h-10", className)}
        responsive
      >
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{
            fill: "var(--color-muted-foreground)",
            fontSize: isMobile ? 9 : 12,
            fontWeight: 500,
            letterSpacing: isMobile ? "0.02em" : "0.12em",
          }}
        />
        <Bar
          dataKey="eaten"
          background={{ fill: "transparent" }}
          maxBarSize={42}
          shape={(props) => (
            <EatenLimitBarShape
              {...(props as Omit<EatenLimitBarShapeProps, "yAxisMax">)}
              yAxisMax={yAxisMax}
            />
          )}
        />
      </BarChart>
    </ChartContainer>
  );
};
