import type { ChartConfig } from "#/shared/components/base/chart.tsx";

import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import {
  StatBarChart,
  type StatBarChartDatum,
} from "#/verticals/goals-analytics/components/StatBarChart.tsx";

export type FatBarChartDatum = {
  eaten: number | null;
  label: string;
  limit: number;
};

type FatBarChartProps = {
  ariaLabel?: string;
  data: FatBarChartDatum[];
  onClick?: () => void;
  tooltipContent?: string;
};

const fatBarChartConfig = {
  value: {
    label: "Fats",
    color: "var(--color-primary-fixed)",
  },
  limit: {
    label: "Limit",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export function FatBarChart({ ariaLabel, data, onClick, tooltipContent }: FatBarChartProps) {
  const chartData: StatBarChartDatum[] = data.map(({ eaten, label, limit }) => ({
    label,
    limit,
    value: eaten,
  }));
  const observedDays = data.filter(({ eaten }) => eaten !== null);
  const averageFatLimitPercent = observedDays.length
    ? Math.round(
        (observedDays.reduce((total, day) => total + (day.limit ? day.eaten! / day.limit : 0), 0) /
          observedDays.length) *
          100,
      )
    : 0;

  return (
    <StatBarChart
      ariaLabel={ariaLabel}
      chartConfig={fatBarChartConfig}
      data={chartData}
      onClick={onClick}
      tooltipContent={tooltipContent}
      valueUnit="g"
    >
      <div className="flex space-between gap-3">
        <div>
          <Typography variant="capsCardTitle" color="onSurface">
            Fat
          </Typography>
        </div>
        <div className="flex-1 justify-end text-right">
          <Typography variant="capsCardTitle" color="primary">
            Avg {averageFatLimitPercent}% of daily limit
          </Typography>
        </div>
      </div>
    </StatBarChart>
  );
}
