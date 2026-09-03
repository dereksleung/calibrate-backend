import type { FoodEntryResponse, MealNameEnumType } from "@calibrate/api-contracts";

import { Typography } from "#/shared/components/base/typography/Typography.tsx";
import { Flame } from "lucide-react";

import { getMealTotals } from "../../log-page-helpers.ts";

type MealSectionProps = {
  meal: MealNameEnumType;
  title: string;
  entries: FoodEntryResponse[];
  onAddFood: (meal: MealNameEnumType) => void;
};

type NutrientSummaryProps = {
  calories: number;
  proteinGrams: number;
  totalFatGrams: number;
  totalCarbohydrateGrams: number;
  portion?: string;
};

function formatWholeNumber(value: number): string {
  return String(Math.round(value));
}

function formatPortion(entry: FoodEntryResponse): string {
  if (entry.quantityMass != null && entry.massUnit) {
    return `${formatWholeNumber(entry.quantityMass)} ${entry.massUnit}`;
  }

  return `${formatWholeNumber(entry.chosenQuantity)} ${entry.chosenUnit}`;
}

function foodItemTitle(entry: FoodEntryResponse): string {
  return entry.brand ? `${entry.name} - ${entry.brand}` : entry.name;
}

function NutrientSummary({
  calories,
  proteinGrams,
  totalFatGrams,
  totalCarbohydrateGrams,
  portion,
}: NutrientSummaryProps) {
  const roundedCalories = formatWholeNumber(calories);
  const protein = formatWholeNumber(proteinGrams);
  const fat = formatWholeNumber(totalFatGrams);
  const carbs = formatWholeNumber(totalCarbohydrateGrams);
  const accessibleLabel = [
    `${roundedCalories} calories`,
    `${protein} grams protein`,
    `${fat} grams fat`,
    `${carbs} grams carbohydrate`,
    portion,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <p
      aria-label={accessibleLabel}
      className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-on-primary-fixed"
    >
      <span className="inline-flex items-center gap-1">
        <Flame aria-hidden className="size-3" />
        {roundedCalories}
      </span>
      <span>
        <span className="font-semibold">P</span> {protein} g
      </span>
      <span>
        <span className="font-semibold">F</span> {fat} g
      </span>
      <span>
        <span className="font-semibold">C</span> {carbs} g
      </span>
      {portion ? <span>• {portion}</span> : null}
    </p>
  );
}

function MealDivider() {
  return <div aria-hidden="true" className="my-3 h-px bg-black/[0.07]" />;
}

export function MealSection({ meal, title, entries, onAddFood }: MealSectionProps) {
  const totals = getMealTotals(entries);
  const headingId = `${meal.toLowerCase()}-heading`;

  return (
    <section aria-labelledby={headingId} className="glass-card rounded-xl p-3">
      <header>
        <Typography as="h3" className="text-on-primary-fixed" id={headingId} variant="h3">
          {title}
        </Typography>
        {entries.length > 0 ? (
          <NutrientSummary
            calories={totals.calories}
            proteinGrams={totals.proteinGrams}
            totalFatGrams={totals.totalFatGrams}
            totalCarbohydrateGrams={totals.totalCarbohydrateGrams}
          />
        ) : null}
      </header>

      {entries.length > 0 ? (
        <>
          <MealDivider />
          <ul className="flex flex-col gap-5" role="list">
            {entries.map((entry) => (
              <li key={entry.id} className="min-w-0">
                <p className="truncate text-base font-semibold text-on-primary-fixed">
                  {foodItemTitle(entry)}
                </p>
                <NutrientSummary
                  calories={entry.calories}
                  proteinGrams={entry.proteinGrams}
                  totalFatGrams={entry.totalFatGrams}
                  totalCarbohydrateGrams={entry.totalCarbohydrateGrams}
                  portion={formatPortion(entry)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <MealDivider />
      <button
        className="flex w-full items-center justify-center text-on-primary-fixed outline-offset-4 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => onAddFood(meal)}
        type="button"
      >
        <Typography as="span" color="inherit" variant="h3">
          + Add Item
        </Typography>
      </button>
    </section>
  );
}
