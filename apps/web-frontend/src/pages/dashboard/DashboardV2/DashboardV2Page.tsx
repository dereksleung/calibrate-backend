import type {
  DashboardNutritionMetric,
  DashboardV2ViewModel,
  HabitCardModel,
  NutritionCardModel,
} from "#/verticals/dashboard/dashboard-v2-model.ts";

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

type DashboardV2PageProps = {
  onOpenNutrientAnalytics: (metric: DashboardNutritionMetric) => void;
  viewModel: DashboardV2ViewModel;
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

function NutritionCard({ model, onOpen }: { model: NutritionCardModel; onOpen: () => void }) {
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
        onClick={onOpen}
      >
        <span className="flex min-w-0 items-baseline gap-1">
          <MiniAnalyticsCard.SummaryStat>{formatAmount(model.amount)}</MiniAnalyticsCard.SummaryStat>
          <span className="truncate text-xs text-on-surface-variant">{model.unit}</span>
        </span>
      </MiniAnalyticsCard.BottomSummary>
    </MiniAnalyticsCard>
  );
}

function DashboardV2Page({ onOpenNutrientAnalytics, viewModel }: DashboardV2PageProps) {
  return (
    <main className="min-h-screen px-4 py-10 subtle-aurora-fade-page-background">
      <div className="mx-auto w-full max-w-[450px] space-y-10">
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-on-primary-fixed">
          Dashboard
        </h1>

        <section aria-labelledby="seven-day-nutrition-heading" className="space-y-3">
          <h2
            className="font-heading text-xl font-semibold tracking-[-0.02em] text-on-primary-fixed"
            id="seven-day-nutrition-heading"
          >
            Seven-day nutrition
          </h2>
          <SevenDayNutrition rows={viewModel.sevenDayNutrition.rows} />
        </section>

        <section aria-labelledby="habits-heading" className="space-y-3">
          <h2
            className="font-heading text-xl font-semibold tracking-[-0.02em] text-on-primary-fixed"
            id="habits-heading"
          >
            Habits
          </h2>
          <div className="grid grid-cols-2 gap-3" data-testid="habit-card-grid">
            <HabitCard model={viewModel.habits.weighIn} />
            <HabitCard model={viewModel.habits.foodLogging} />
          </div>
        </section>

        <section aria-labelledby="nutrition-heading" className="space-y-3">
          <h2
            className="font-heading text-xl font-semibold tracking-[-0.02em] text-on-primary-fixed"
            id="nutrition-heading"
          >
            Nutrition
          </h2>
          <div className="grid grid-cols-2 gap-3" data-testid="nutrition-card-grid">
            {NUTRITION_CARD_ORDER.map((metric) => (
              <NutritionCard
                key={metric}
                model={viewModel.nutritionCards[metric]}
                onOpen={() => onOpenNutrientAnalytics(metric)}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export { DashboardV2Page };
export type { DashboardV2PageProps };
