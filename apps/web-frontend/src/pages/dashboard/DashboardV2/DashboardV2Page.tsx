import type {
  DashboardNutritionMetric,
  DashboardV2ViewModel,
  HabitCardModel,
  NutritionCardModel,
} from "#/verticals/dashboard/dashboard-v2-model.ts";

import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { APP_CONTENT_FRAME_CLASS_NAME } from "#/shared/layout/app-content-frame.ts";
import { useRef, useState } from "react";

import { DashboardAnalyticsDrawer } from "./components/DashboardAnalyticsDrawer.tsx";
import { MiniAnalyticsCard } from "./components/MiniAnalyticsCard.tsx";
import { SevenDayNutrition } from "./components/SevenDayNutrition.tsx";

const NUTRITION_CARD_ORDER: DashboardNutritionMetric[] = [
  "calories",
  "proteinGrams",
  "totalFatGrams",
  "totalCarbohydrateGrams",
];

const NUTRITION_COLORS = {
  calories: "bg-calories-stone",
  proteinGrams: "bg-protein-vibrant-rose",
  totalFatGrams: "bg-fats-vibrant-violet",
  totalCarbohydrateGrams: "bg-carbs-vibrant-azure",
} as const;

const PENDING_NUTRITION_TITLES = ["Calories", "Protein", "Fats", "Carbs"] as const;
const PENDING_HABIT_TITLES = ["Weighing", "Food Logs"] as const;

type DashboardV2PageProps = {
  error?: Error | null;
  isPending?: boolean;
  onRetry?: () => void;
  viewModel?: DashboardV2ViewModel;
};

function formatAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function HabitCard({ model }: { model: HabitCardModel }) {
  return (
    <MiniAnalyticsCard title={model.title}>
      <MiniAnalyticsCard.Title>{model.title}</MiniAnalyticsCard.Title>
      <MiniAnalyticsCard.Subtitle>{model.subtitle}</MiniAnalyticsCard.Subtitle>
      <MiniAnalyticsCard.ChartArea
        className="mt-4 grid grid-cols-10 gap-1.5"
        role="img"
        aria-label={`${model.title}: ${model.completedCurrentWeek} of 7 days this week`}
      >
        {model.days.map((day) => (
          <span
            aria-label={`${day.date}: ${day.status}`}
            className={
              day.status === "complete"
                ? "aspect-square rounded-sm bg-primary"
                : "aspect-square rounded-sm bg-black/[0.055]"
            }
            key={day.date}
          />
        ))}
      </MiniAnalyticsCard.ChartArea>
      <MiniAnalyticsCard.Separator className="my-4" />
      <MiniAnalyticsCard.BottomSummary interactive={false}>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <MiniAnalyticsCard.SummaryStat>{model.completedCurrentWeek}/7</MiniAnalyticsCard.SummaryStat>
          <span className="truncate text-xs text-on-surface-variant">this week</span>
        </span>
      </MiniAnalyticsCard.BottomSummary>
    </MiniAnalyticsCard>
  );
}

function NutritionCard({
  model,
  onOpen,
}: {
  model: NutritionCardModel;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const fillPercentage = Math.min((model.amount / (model.target * 1.25)) * 100, 100);

  return (
    <MiniAnalyticsCard title={model.title}>
      <MiniAnalyticsCard.Title>{model.title}</MiniAnalyticsCard.Title>
      <MiniAnalyticsCard.Subtitle>Today</MiniAnalyticsCard.Subtitle>
      <MiniAnalyticsCard.ChartArea className="mt-5">
        <div
          aria-label={`${formatAmount(model.amount)} ${model.unit} of ${formatAmount(model.target)} ${model.unit}`}
          className="relative h-2 overflow-visible rounded-full bg-black/[0.055]"
          role="img"
        >
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${NUTRITION_COLORS[model.metric]}`}
            style={{ width: `${fillPercentage}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute -top-0.5 bottom-[-0.125rem] left-[80%] w-0.5 rounded-full bg-on-surface-variant/70"
          />
        </div>
      </MiniAnalyticsCard.ChartArea>
      <MiniAnalyticsCard.Separator className="my-4" />
      <MiniAnalyticsCard.BottomSummary
        accessibleName={`Open ${model.title} analytics`}
        interactive
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <span className="flex min-w-0 items-baseline gap-1">
          <MiniAnalyticsCard.SummaryStat>{formatAmount(model.amount)}</MiniAnalyticsCard.SummaryStat>
          <span className="truncate text-xs text-on-surface-variant">{model.unit}</span>
        </span>
      </MiniAnalyticsCard.BottomSummary>
    </MiniAnalyticsCard>
  );
}

function PendingSevenDayNutrition() {
  return (
    <section aria-hidden="true" className="glass-card rounded-xl p-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 border-b border-black/[0.06] py-2 first:pt-0 last:border-b-0 last:pb-0"
          key={index}
        >
          <div className="h-8 animate-pulse rounded bg-black/[0.055]" />
          <div className="h-12 animate-pulse rounded bg-black/[0.055] sm:h-20" />
        </div>
      ))}
    </section>
  );
}

function PendingHabitCard({ title }: { title: (typeof PENDING_HABIT_TITLES)[number] }) {
  return (
    <MiniAnalyticsCard title={title}>
      <MiniAnalyticsCard.Title>{title}</MiniAnalyticsCard.Title>
      <MiniAnalyticsCard.Subtitle>Last 30 Days</MiniAnalyticsCard.Subtitle>
      <MiniAnalyticsCard.ChartArea
        aria-label={`${title}: history unavailable`}
        className="mt-4 grid grid-cols-10 gap-1.5"
        role="img"
      >
        {Array.from({ length: 30 }, (_, index) => (
          <span aria-hidden="true" className="aspect-square rounded-sm bg-black/[0.055]" key={index} />
        ))}
      </MiniAnalyticsCard.ChartArea>
      <MiniAnalyticsCard.Separator className="my-4" />
      <MiniAnalyticsCard.BottomSummary interactive={false}>
        <span aria-hidden="true" className="h-5 w-12 animate-pulse rounded bg-black/[0.055]" />
      </MiniAnalyticsCard.BottomSummary>
    </MiniAnalyticsCard>
  );
}

function PendingNutritionCard({ title }: { title: (typeof PENDING_NUTRITION_TITLES)[number] }) {
  return (
    <MiniAnalyticsCard title={title}>
      <MiniAnalyticsCard.Title>{title}</MiniAnalyticsCard.Title>
      <MiniAnalyticsCard.Subtitle>Today</MiniAnalyticsCard.Subtitle>
      <MiniAnalyticsCard.ChartArea className="mt-5">
        <div aria-hidden="true" className="h-2 animate-pulse rounded-full bg-black/[0.055]" />
      </MiniAnalyticsCard.ChartArea>
      <MiniAnalyticsCard.Separator className="my-4" />
      <MiniAnalyticsCard.BottomSummary interactive={false}>
        <span aria-hidden="true" className="h-5 w-16 animate-pulse rounded bg-black/[0.055]" />
      </MiniAnalyticsCard.BottomSummary>
    </MiniAnalyticsCard>
  );
}

function DashboardSections({
  onOpenNutrition,
  viewModel,
}: {
  onOpenNutrition: (metric: DashboardNutritionMetric, trigger: HTMLButtonElement) => void;
  viewModel: DashboardV2ViewModel;
}) {
  return (
    <>
      <section aria-labelledby="seven-day-nutrition-heading" className="space-y-3">
        <Typography
          as="h2"
          className="text-on-primary-fixed"
          id="seven-day-nutrition-heading"
          variant="h2SectionTitle"
        >
          Seven-day nutrition
        </Typography>
        <SevenDayNutrition rows={viewModel.sevenDayNutrition.rows} />
      </section>

      <section aria-labelledby="habits-heading" className="space-y-3">
        <Typography as="h2" className="text-on-primary-fixed" id="habits-heading" variant="h2SectionTitle">
          Habits
        </Typography>
        <div className="grid grid-cols-2 gap-3" data-testid="habit-card-grid">
          <HabitCard model={viewModel.habits.weighIn} />
          <HabitCard model={viewModel.habits.foodLogging} />
        </div>
      </section>

      <section aria-labelledby="nutrition-heading" className="space-y-3">
        <Typography as="h2" className="text-on-primary-fixed" id="nutrition-heading" variant="h2SectionTitle">
          Nutrition
        </Typography>
        <div className="grid grid-cols-2 gap-3" data-testid="nutrition-card-grid">
          {NUTRITION_CARD_ORDER.map((metric) => (
            <NutritionCard
              key={metric}
              model={viewModel.nutritionCards[metric]}
              onOpen={(trigger) => onOpenNutrition(metric, trigger)}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function PendingDashboardSections() {
  return (
    <>
      <section aria-labelledby="seven-day-nutrition-heading" className="space-y-3">
        <Typography
          as="h2"
          className="text-on-primary-fixed"
          id="seven-day-nutrition-heading"
          variant="h2SectionTitle"
        >
          Seven-day nutrition
        </Typography>
        <PendingSevenDayNutrition />
      </section>

      <section aria-labelledby="habits-heading" className="space-y-3">
        <Typography as="h2" className="text-on-primary-fixed" id="habits-heading" variant="h2SectionTitle">
          Habits
        </Typography>
        <div className="grid grid-cols-2 gap-3" data-testid="habit-card-grid">
          {PENDING_HABIT_TITLES.map((title) => (
            <PendingHabitCard key={title} title={title} />
          ))}
        </div>
      </section>

      <section aria-labelledby="nutrition-heading" className="space-y-3">
        <Typography as="h2" className="text-on-primary-fixed" id="nutrition-heading" variant="h2SectionTitle">
          Nutrition
        </Typography>
        <div className="grid grid-cols-2 gap-3" data-testid="nutrition-card-grid">
          {PENDING_NUTRITION_TITLES.map((title) => (
            <PendingNutritionCard key={title} title={title} />
          ))}
        </div>
      </section>
    </>
  );
}

function DashboardLoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="glass-card rounded-xl p-4" role="alert">
      <p className="font-heading text-lg font-semibold text-on-primary-fixed">
        Live nutrition is unavailable
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">Your dashboard could not be loaded.</p>
      {onRetry ? (
        <button className="mt-3 self-start text-primary underline" onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}

function DashboardV2Page({ error = null, isPending = false, onRetry, viewModel }: DashboardV2PageProps) {
  const [selectedMetric, setSelectedMetric] = useState<DashboardNutritionMetric | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selectedModel = viewModel && selectedMetric ? viewModel.analytics[selectedMetric] : null;

  return (
    <>
      <main className="pt-4">
        <div className={APP_CONTENT_FRAME_CLASS_NAME}>
          <h1 className="hidden md:block md:sr-only">Overview</h1>
          <div className="space-y-8">
            {error ? <DashboardLoadError onRetry={onRetry} /> : null}
            {viewModel ? (
              <DashboardSections
                onOpenNutrition={(metric, trigger) => {
                  returnFocusRef.current = trigger;
                  setSelectedMetric(metric);
                }}
                viewModel={viewModel}
              />
            ) : isPending ? (
              <div aria-busy="true" aria-label="Loading dashboard" role="status">
                <PendingDashboardSections />
              </div>
            ) : (
              <PendingDashboardSections />
            )}
          </div>
        </div>
      </main>

      <DashboardAnalyticsDrawer
        model={selectedModel}
        onClose={() => setSelectedMetric(null)}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}

export { DashboardV2Page };
export type { DashboardV2PageProps };
