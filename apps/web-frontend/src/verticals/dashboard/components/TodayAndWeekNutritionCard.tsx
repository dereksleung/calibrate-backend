import type { DashboardNutritionCardModel } from "#/verticals/dashboard/dashboard-nutrition-model.ts";

import { Card } from "#/shared/components/base/Card.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { EatenDonutChart } from "#/shared/components/charts/EatenDonutChart.tsx";
import { WeeklyBarChart } from "#/shared/components/charts/WeeklyBarChart.tsx";
import { TodayAndWeekChartTextAlternative } from "#/verticals/dashboard/components/TodayAndWeekChartTextAlternative.tsx";
import { useId } from "react";

export const TodayAndWeekNutritionCard = ({ model }: { model: DashboardNutritionCardModel }) => {
  const headingId = useId();
  const summaryId = useId();

  return (
    <Card
      aria-describedby={summaryId}
      aria-labelledby={headingId}
      className="p-4 md:p-6 gap-4 flex-col lg:items-center"
      role="region"
    >
      <Typography id={headingId} as="h2" variant="cardTitle" color="primary" className="self-start ml-3 mt-3">
        {model.title}
      </Typography>
      <TodayAndWeekChartTextAlternative
        describedById={summaryId}
        today={model.today}
        metricLabel={model.title}
        unit={model.unit}
        weeklyData={model.weeklyData}
      />
      <div className="flex flex-1 self-stretch gap-4">
        <div className="flex min-w-0 flex-1 justify-center">
          <EatenDonutChart eaten={model.today.eaten} limit={model.today.limit} metricLabel={model.title} />
        </div>

        <div className="min-w-0 flex-2">
          <WeeklyBarChart
            weeklyData={model.weeklyData}
            seriesLabel={model.title}
            className="aspect-auto min-h-[8rem] md:min-h-[13rem] max-h-[17rem] w-full"
          />
        </div>
      </div>
    </Card>
  );
};
