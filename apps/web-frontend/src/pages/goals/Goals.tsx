import { useEffect, useRef, useState } from "react";
import { TrendingDown } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

// import { cn } from "#/lib/utils.ts";
import { Button } from "#/shared/components/base/Button.tsx";
import {
  Card,
  CardContent,
  CardTitle,
} from "#/shared/components/base/Card.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "#/shared/components/base/chart.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "#/shared/components/base/drawer.tsx";
import { FatsAnalytics } from "#/verticals/goals-analytics/components/FatsAnalytics.tsx";
import { FatBarChart } from "#/verticals/goals-analytics/components/FatBarChart.tsx";
import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { useIsMobile } from "#/shared/hooks/use-media-query.ts";

// const GOAL_TABS = ["1W", "1M", "3M", "Plan"] as const;

// type GoalTab = (typeof GOAL_TABS)[number];
type AnalyticsDrawerContent = "fats";

type GoalsProps = {
  openFatsAnalytics?: boolean;
};

const JOURNEY_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCXHD-C_7DzoORGBlhQEayIAZvNgeTVMM4FMeM6BGWET_HfdXvcm_MnHFn2_7QL9hVMQ9RmC-ROXAkFA-epORDLxaZ9WCyairiFsWBnyJ9Pn5izptULWIha5Y55osPr1oYFHNMnHWYEii2t-QY8fsQ-4q1M-lW2zDbO7KSS1A2Ow-fp1aC9DKB9Ziy2R5jCrytOBxlWqRkFHuAVjZwcO2LHVcMFlzJU5GLt0NdBU8ILQudTuPJTi7Ma2_suLfSE7hC1H79MXm3Iol0";

const weeklyWeightData = [
  { date: "2024-01-12", label: "Jan 12", weight: 144.5 },
  { date: "2024-01-13", label: "Jan 13", weight: 144.1 },
  { date: "2024-01-14", label: "Jan 14", weight: 144.3 },
  { date: "2024-01-15", label: "Jan 15", weight: 143.1 },
  { date: "2024-01-16", label: "Jan 16", weight: 142.8 },
  { date: "2024-01-17", label: "Jan 17", weight: 142.9 },
  { date: "2024-01-18", label: "Jan 18", weight: 137.1 },
] as const;

const FAT_DAILY_LIMIT_GRAMS = 58;

const weeklyFatData = [
  { label: "M", eaten: 29, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "T", eaten: 35, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "W", eaten: 44, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "Th", eaten: 52, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "F", eaten: 58, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "Sa", eaten: 61, limit: FAT_DAILY_LIMIT_GRAMS },
  { label: "Sn", eaten: 64, limit: FAT_DAILY_LIMIT_GRAMS },
];

const weightChartConfig = {
  weight: {
    label: "Weight",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export function Goals({ openFatsAnalytics = false }: GoalsProps) {
  // const [activeTab, setActiveTab] = useState<GoalTab>("1M");
  const [activeDrawerContent, setActiveDrawerContent] =
    useState<AnalyticsDrawerContent | null>(null);
  const fatsChartRef = useRef<HTMLDivElement>(null);

  const handleAnalyticsDrawerOpenChange = (open: boolean) => {
    if (!open) {
      setActiveDrawerContent(null);
    }
  };

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!openFatsAnalytics) {
      return;
    }

    setActiveDrawerContent("fats");

    const animationFrameId = window.requestAnimationFrame(() => {
      fatsChartRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [openFatsAnalytics]);

  return (
    <>
      <main className="min-h-screen bg-surface px-4 pb-12 pt-0 antialiased md:px-10 md:pb-20">
        {/* <div
          className="sticky top-14 z-20 -mx-4 border-b border-white/25 bg-surface/90 px-4 py-3 backdrop-blur-md md:-mx-10 md:px-10"
        >
          <div className="mx-auto w-full max-w-[64rem]">
            <div
              className="mx-auto grid h-14 w-full max-w-[28.5rem] grid-cols-4 rounded-full bg-surface-container px-1 py-1 shadow-inner"
              role="tablist"
              aria-label="Goal timeframe"
            >
              {GOAL_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={cn(
                    "rounded-full px-3 text-base font-medium text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-lg",
                    activeTab === tab
                      ? "bg-white text-primary shadow-[0_10px_24px_-18px_rgba(0,0,0,0.65)]"
                      : "hover:bg-white/45",
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div> */}

      <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-8 pt-8 md:pt-10">
        <header className="flex self-stretch flex-col gap-5">
          <div className="flex self-stretch justify-between">
            <Typography
              variant="headlineLg"
              as="h1"
              // className="font-heading text-[2.5rem] font-light leading-none text-primary md:text-[3rem]"
            >
              Goals
            </Typography>
            <Button
              variant="outline"
              className="h-12 w-fit border-white/70 bg-white/80 px-8 text-base font-medium text-primary shadow-[0_16px_36px_-22px_rgba(0,0,0,0.45)] hover:bg-white"
            >
              Edit Plan
            </Button>
          </div>
          <p className="text-base text-on-surface md:text-lg">
            Drill down into your stats and progress
          </p>
        </header>

        <Card className="rounded-[14px] border-white/70 bg-white/60 py-0 shadow-[0_28px_70px_-44px_rgba(0,0,0,0.65)]">
          <CardContent className="flex min-h-32 flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center md:px-8">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-fixed/45 text-primary md:size-16">
              <TrendingDown aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Typography variant="capsCardTitle" color="onSurface">
                Active Program
              </Typography>
              <CardTitle className="mt-2 font-sans text-2xl font-light leading-tight text-foreground md:text-[1.75rem]">
                Lose 1 lb per week
              </CardTitle>
            </div>
            <p className="text-base font-medium text-primary sm:ml-auto md:text-lg">
              Healthy Pace
            </p>
          </CardContent>
        </Card>

        <section
          className="min-h-52 overflow-hidden rounded-[24px] bg-cover bg-center text-white shadow-[0_28px_70px_-44px_rgba(0,0,0,0.65)] md:min-h-58"
          style={{
            backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-primary) 38%, transparent), color-mix(in srgb, var(--color-primary) 38%, transparent)), url(${JOURNEY_IMAGE_URL})`,
          }}
        >
          <div className="flex min-h-52 flex-col justify-center px-6 py-8 md:min-h-58 md:px-8">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/90 md:text-base">
              Your Journey
            </p>
            <p className="mt-3 font-heading text-[2rem] font-light leading-none text-white md:text-[2.5rem]">
              90 days to goal
            </p>
            <p className="mt-4 text-base font-medium text-white md:text-lg">
              Keep the steady pace. You're doing great.
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-8 md:flex-row">
          <Card className="flex-1 rounded-[14px] border-white/70 bg-white/60 py-0 shadow-[0_28px_70px_-44px_rgba(0,0,0,0.65)]">
            <CardContent className="p-4 md:p-8">
              <div className="flex space-between gap-3">
                <div className="flex-1">
                  <Typography variant="capsCardTitle" color="onSurface">
                    Weight
                  </Typography>
                </div>
                <div className="flex-1 justify-end text-right">
                  <Typography variant="capsCardTitle" color="primary" as="p">
                    -7.4 lbs
                  </Typography>
                </div>
              </div>

              <ChartContainer
                config={weightChartConfig}
                className="mt-4 w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={weeklyWeightData}
                  margin={{ top: 16, right: 8, left: 8 }}
                  responsive
                  className="flex-1"
                >
                  <YAxis
                    dataKey="weight"
                    padding={{ top: 8 }}
                    width="auto"
                  />
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
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        labelFormatter={(_, payload) =>
                          payload[0]?.payload?.label ?? ""
                        }
                        formatter={(value) => (
                          <span className="font-medium text-foreground">
                            {Number(value).toFixed(1)} lbs lost
                          </span>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-weight)"
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: "var(--color-primary)",
                      stroke: "var(--color-primary)",
                      strokeWidth: 1,
                    }}
                    activeDot={{
                      r: 5,
                      fill: "var(--color-primary)",
                      stroke: "var(--color-primary)",
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div ref={fatsChartRef} className="flex-1">
            <FatBarChart
              ariaLabel="Open fats analytics"
              data={weeklyFatData}
              onClick={() => setActiveDrawerContent("fats")}
              tooltipContent="Click to open a more detailed fats view."
            />
          </div>
        </div>
      </div>
      </main>

      <Drawer
        direction={isMobile ? "bottom" : "right"}
        open={activeDrawerContent !== null}
        onOpenChange={handleAnalyticsDrawerOpenChange}
      >
        <DrawerContent className="h-[80vh] w-full bg-surface-container-low md:h-full md:max-w-[28rem]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Fats Analytics</DrawerTitle>
            <DrawerDescription>
              Total fat summary and food source contributions.
            </DrawerDescription>
          </DrawerHeader>
          {activeDrawerContent === "fats" ? <FatsAnalytics /> : null}
        </DrawerContent>
      </Drawer>
    </>
  );
}
