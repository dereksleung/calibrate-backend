import { apiTransport } from "#/shared/api/api-client.ts";
import { Card } from "#/shared/components/base/Card.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/shared/components/base/tooltip/Tooltip.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { ConsistencyScore } from "#/verticals/dashboard/components/ConsistencyScore.tsx";
import { HighImpactSwap } from "#/verticals/dashboard/components/HighImpactSwap.tsx";
import { TodayAndWeekCalories } from "#/verticals/dashboard/components/TodayAndWeekCalories.tsx";
import { TodayAndWeekStat } from "#/verticals/dashboard/components/TodayAndWeekStat.tsx";
import { YesterdayRecap } from "#/verticals/dashboard/components/YesterdayRecap.tsx";
import { useDashboardDayLogRange } from "#/verticals/dashboard/dashboard-day-log-query.ts";
import {
  buildDashboardNutritionModels,
  getDashboardNutritionDateRange,
} from "#/verticals/dashboard/dashboard-nutrition-model.ts";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

const FATS_ANALYTICS_TOOLTIP = "Click to open a more detailed fats view.";

export const Dashboard = () => {
  const dayLogRange = getDashboardNutritionDateRange();
  const { data, error, isPending, refetch } = useDashboardDayLogRange(apiTransport, dayLogRange);
  const nutritionModels = data ? buildDashboardNutritionModels(data) : undefined;

  useEffect(() => {
    if (!isPending && error) {
      toast.error(error.message, { closeButton: true });
    }
  }, [error, isPending]);

  return (
    <main className="px-4 md:px-10 pb-8 pt-14 antialiased subtle-aurora-fade-page-background">
      <section className="space-y-6">
        <Typography as="h1" variant="headline" color="onSurface">
          Daily Insights
        </Typography>
        <div className="grid auto-cols-[75%] grid-flow-col items-stretch gap-4 overflow-x-auto pb-2 [scrollbar-width:none] hover:[scrollbar-width:thin] [&::-webkit-scrollbar]:h-0 hover:[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-track]:bg-transparent md:grid-flow-row md:grid-cols-3 md:auto-cols-auto md:gap-8 md:overflow-visible md:pb-0 md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
          <HighImpactSwap />
          <YesterdayRecap />
          <ConsistencyScore />
        </div>
      </section>
      <section className="mt-10 space-y-4 lg:space-y-8">
        <Typography as="h2" variant="headline" color="onSurface">
          Daily & Weekly Stats
        </Typography>
        {nutritionModels ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
            <TodayAndWeekCalories model={nutritionModels.calories} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  aria-label="Open fats analytics details"
                  className="block h-full"
                  to="/goals"
                  search={{ openFatsAnalytics: true }}
                >
                  <TodayAndWeekStat model={nutritionModels.totalFatGrams} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">{FATS_ANALYTICS_TOOLTIP}</TooltipContent>
            </Tooltip>
            <TodayAndWeekStat model={nutritionModels.proteinGrams} />
            <TodayAndWeekStat model={nutritionModels.totalCarbohydrateGrams} />
          </div>
        ) : error ? (
          <Card className="p-6 lg:col-span-2" role="alert">
            <Typography as="h3" variant="cardTitle" color="primary">
              Live nutrition is unavailable
            </Typography>
            <p className="text-muted-foreground">Your nutrition statistics could not be loaded.</p>
            <button
              className="self-start text-primary underline"
              onClick={() => void refetch()}
              type="button"
            >
              Try again
            </button>
          </Card>
        ) : (
          <div
            aria-label="Loading live nutrition statistics"
            className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8"
            role="status"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <Card aria-hidden="true" className="min-h-80 animate-pulse bg-muted" key={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
