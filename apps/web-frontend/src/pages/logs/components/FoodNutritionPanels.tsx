import type { ScaledFoodNutrition } from "./confirm-food-nutrition.ts";

import { DAILY_TARGETS, MACRO_PROGRESS_COLORS } from "../log-page-helpers.ts";

type FoodNutritionPanelsProps = {
  nutrition: ScaledFoodNutrition;
};

const CALORIE_RING_RADIUS = 27;
const CALORIE_RING_CIRCUMFERENCE = 2 * Math.PI * CALORIE_RING_RADIUS;

function formatNutrition(value: number | null, unit: "g" | "mg") {
  if (value === null) return "—";

  return `${Number(value.toFixed(1))}${unit}`;
}

function getDailyGoalPercent(value: number, target: number) {
  return target > 0 ? Math.round((value / target) * 100) : 0;
}

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  const target =
    label === "Carbs"
      ? DAILY_TARGETS.totalCarbohydrateGrams
      : label === "Fat"
        ? DAILY_TARGETS.totalFatGrams
        : DAILY_TARGETS.proteinGrams;
  const percent = getDailyGoalPercent(value, target);

  return (
    <div className="min-w-0 text-center">
      <p className="text-xs font-medium tabular-nums" style={{ color }}>
        {percent}%
      </p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums text-on-surface">
        {formatNutrition(value, "g")}
      </p>
      <p className="mt-0.5 text-[0.625rem] font-medium tracking-[0.1em] text-on-surface-variant/70 uppercase">
        {label}
      </p>
    </div>
  );
}

export function NutritionAtGlance({ nutrition }: FoodNutritionPanelsProps) {
  const caloriePercent = getDailyGoalPercent(nutrition.calories, DAILY_TARGETS.calories);
  const ringPercent = Math.min(caloriePercent, 100);
  const dashOffset = CALORIE_RING_CIRCUMFERENCE * (1 - ringPercent / 100);

  return (
    <section
      aria-labelledby="nutrition-at-a-glance-heading"
      className="rounded-2xl bg-surface-container-lowest px-6 py-6 shadow-[0_18px_45px_-32px_rgba(26,28,28,0.42)]"
    >
      <h2 id="nutrition-at-a-glance-heading" className="sr-only">
        Nutrition at a glance
      </h2>
      <div className="flex items-center gap-5">
        <div
          aria-label={`${Math.round(nutrition.calories)} calories, ${caloriePercent}% of the daily calorie goal`}
          className="relative size-16 shrink-0"
        >
          <svg aria-hidden className="size-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={CALORIE_RING_RADIUS}
              fill="none"
              stroke="var(--color-surface-container)"
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r={CALORIE_RING_RADIUS}
              fill="none"
              stroke={MACRO_PROGRESS_COLORS.calories}
              strokeDasharray={CALORIE_RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold tabular-nums text-on-surface">
              {Math.round(nutrition.calories)} cal
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
          <MacroStat
            label="Carbs"
            value={nutrition.totalCarbohydrateGrams}
            color={MACRO_PROGRESS_COLORS.totalCarbohydrateGrams}
          />
          <MacroStat
            label="Fat"
            value={nutrition.totalFatGrams}
            color={MACRO_PROGRESS_COLORS.totalFatGrams}
          />
          <MacroStat
            label="Protein"
            value={nutrition.proteinGrams}
            color={MACRO_PROGRESS_COLORS.proteinGrams}
          />
        </div>
      </div>
    </section>
  );
}

const dailyGoalMetrics = [
  { label: "Calories", target: DAILY_TARGETS.calories, color: MACRO_PROGRESS_COLORS.calories },
  {
    label: "Carbs",
    target: DAILY_TARGETS.totalCarbohydrateGrams,
    color: MACRO_PROGRESS_COLORS.totalCarbohydrateGrams,
  },
  { label: "Fat", target: DAILY_TARGETS.totalFatGrams, color: MACRO_PROGRESS_COLORS.totalFatGrams },
  { label: "Protein", target: DAILY_TARGETS.proteinGrams, color: MACRO_PROGRESS_COLORS.proteinGrams },
] as const;

function getMetricValue(nutrition: ScaledFoodNutrition, label: (typeof dailyGoalMetrics)[number]["label"]) {
  switch (label) {
    case "Calories":
      return nutrition.calories;
    case "Carbs":
      return nutrition.totalCarbohydrateGrams;
    case "Fat":
      return nutrition.totalFatGrams;
    case "Protein":
      return nutrition.proteinGrams;
  }
}

export function DailyGoalProgress({ nutrition }: FoodNutritionPanelsProps) {
  return (
    <section aria-labelledby="daily-goals-heading">
      <h2 id="daily-goals-heading" className="px-1 font-heading text-lg font-medium text-on-surface">
        Percent of Daily Goals
      </h2>
      <dl className="mt-3 grid grid-cols-4 gap-3 rounded-2xl bg-surface-container-lowest px-5 py-5 shadow-[0_18px_45px_-32px_rgba(26,28,28,0.42)]">
        {dailyGoalMetrics.map((metric) => {
          const percent = getDailyGoalPercent(getMetricValue(nutrition, metric.label), metric.target);
          const barPercent = Math.min(percent, 100);

          return (
            <div key={metric.label} className="min-w-0 text-center">
              <div
                role="progressbar"
                aria-label={`${metric.label} daily goal`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={barPercent}
                aria-valuetext={`${percent}% of daily ${metric.label.toLowerCase()} goal`}
                className="h-1.5 overflow-hidden rounded-full bg-surface-container"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barPercent}%`, backgroundColor: metric.color }}
                />
              </div>
              <dd className="mt-2 text-sm font-semibold tabular-nums text-on-surface">{percent}%</dd>
              <dt className="mt-0.5 text-[0.625rem] font-medium tracking-[0.1em] text-on-surface-variant/70 uppercase">
                {metric.label === "Calories" ? "Cals" : metric.label}
              </dt>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function NutritionFacts({ nutrition }: FoodNutritionPanelsProps) {
  const facts = [
    { label: "Calories", value: `${Math.round(nutrition.calories)} cal` },
    { label: "Total fat", value: formatNutrition(nutrition.totalFatGrams, "g") },
    { label: "Saturated fat", value: formatNutrition(nutrition.saturatedFatGrams, "g") },
    { label: "Cholesterol", value: formatNutrition(nutrition.cholesterolMg, "mg") },
    { label: "Sodium", value: formatNutrition(nutrition.sodiumMg, "mg") },
    { label: "Total carbohydrates", value: formatNutrition(nutrition.totalCarbohydrateGrams, "g") },
    { label: "Fiber", value: formatNutrition(nutrition.fiberGrams, "g") },
    { label: "Sugar", value: formatNutrition(nutrition.sugarGrams, "g") },
    { label: "Protein", value: formatNutrition(nutrition.proteinGrams, "g") },
  ];

  return (
    <section
      aria-labelledby="nutrition-facts-heading"
      className="rounded-2xl bg-surface-container-lowest px-6 py-6 shadow-[0_18px_45px_-32px_rgba(26,28,28,0.42)]"
    >
      <h2 id="nutrition-facts-heading" className="font-heading text-lg font-medium text-on-surface">
        Nutrition Facts
      </h2>
      <dl className="mt-4">
        {facts.map((fact, index) => (
          <div
            key={fact.label}
            className={`flex items-center justify-between gap-4 py-3 ${index === 0 ? "pt-0" : "border-t border-surface-container/70"}`}
          >
            <dt className={index === 0 ? "font-medium text-on-surface" : "text-sm text-on-surface-variant"}>
              {fact.label}
            </dt>
            <dd
              className={
                index === 0
                  ? "text-lg font-semibold tabular-nums text-on-surface"
                  : "text-sm font-medium tabular-nums text-on-surface"
              }
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
