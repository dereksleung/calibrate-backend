import { Tooltip, TooltipContent, TooltipTrigger } from "#/shared/components/base/tooltip/Tooltip.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { useIsLgAndAbove } from "#/shared/hooks/use-media-query.ts";
import { ConsistencyScore } from "#/verticals/dashboard/components/ConsistencyScore.tsx";
import { HighImpactSwap } from "#/verticals/dashboard/components/HighImpactSwap.tsx";
import { TodayAndWeekCalories } from "#/verticals/dashboard/components/TodayAndWeekCalories.tsx";
import { TodayAndWeekStat } from "#/verticals/dashboard/components/TodayAndWeekStat.tsx";
import { YesterdayRecap } from "#/verticals/dashboard/components/YesterdayRecap.tsx";
import { Link } from "@tanstack/react-router";

const FATS_ANALYTICS_TOOLTIP = "Click to open a more detailed fats view.";

export const Dashboard = () => {
  const isLgAndAbove = useIsLgAndAbove();

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
      {isLgAndAbove ? (
        <>
          <Typography as="h1" variant="headline" color="onSurface" className="mt-10">
            Daily & Weekly Stats
          </Typography>
          <section className="flex gap-8 mt-8">
            <div className="flex-1">
              <TodayAndWeekCalories />
            </div>
            <div className="flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    aria-label="Open fats analytics details"
                    to="/goals"
                    search={{ openFatsAnalytics: true }}
                  >
                    <TodayAndWeekStat title="Fats" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">{FATS_ANALYTICS_TOOLTIP}</TooltipContent>
              </Tooltip>
            </div>
          </section>
          <section className="flex gap-8 mt-8">
            <div className="flex-1">
              <TodayAndWeekStat title="Protein" />
            </div>
            <div className="flex-1">
              <TodayAndWeekStat title="Carbs" />
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-4 mt-10">
            <Typography as="h2" variant="headline" color="onSurface">
              Daily & Weekly Stats
            </Typography>
            <div className="flex-1">
              <TodayAndWeekCalories />
            </div>
            <div className="flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    aria-label="Open fats analytics details"
                    to="/goals"
                    search={{ openFatsAnalytics: true }}
                  >
                    <TodayAndWeekStat title="Fats" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">{FATS_ANALYTICS_TOOLTIP}</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex-1">
              <TodayAndWeekStat title="Protein" />
            </div>
            <div className="flex-1">
              <TodayAndWeekStat title="Carbs" />
            </div>
          </section>
        </>
      )}
    </main>
  );
};
