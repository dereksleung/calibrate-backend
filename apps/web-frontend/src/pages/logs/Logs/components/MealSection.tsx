import type { FoodEntryResponse, MealNameEnumType } from "@calibrate/api-contracts";

import { Button } from "#/shared/components/base/Button.tsx";
import { Plus, Utensils } from "lucide-react";

import { getMealTotals } from "../../log-page-helpers.ts";

type MealSectionProps = {
  meal: MealNameEnumType;
  title: string;
  entries: FoodEntryResponse[];
  onAddFood: (meal: MealNameEnumType) => void;
};

export function MealSection({ meal, title, entries, onAddFood }: MealSectionProps) {
  const totals = getMealTotals(entries);
  const headingId = `${meal.toLowerCase()}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="glass-card space-y-4 rounded-[2rem] px-8 py-9 md:rounded-2xl md:px-10 md:py-8"
    >
      <div className="flex items-end justify-between gap-4">
        <h2
          id={headingId}
          className="font-heading text-3xl font-light leading-tight text-on-surface md:text-2xl"
        >
          {title}
        </h2>
        <p className="text-xl font-light text-on-surface-variant/80 md:text-base">
          {Math.round(totals.calories)} kcal
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] md:rounded-none">
        {entries.length > 0 ? (
          <>
            <ul role="list" className="divide-y divide-outline-variant/60">
              {entries.map((entry) => (
                <li key={entry.id} className="grid grid-cols-[1fr_auto] gap-4 px-8 py-7 md:px-0 md:py-4">
                  <div className="min-w-0">
                    <p className="text-xl font-light leading-snug text-on-surface md:text-lg">{entry.name}</p>
                    <p className="mt-1 text-sm font-light text-on-surface-variant/70">{`${entry.chosenQuantity} ${entry.chosenUnit}`}</p>
                  </div>
                  <p className="text-xl font-light text-on-surface-variant md:text-lg">
                    {Math.round(entry.calories)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-outline-variant/60 px-8 py-5 text-center md:border-t-0 md:px-0 md:pt-4 md:text-left">
              <Button variant="ghost" className="gap-3 text-primary" onClick={() => onAddFood(meal)}>
                <Plus aria-hidden className="size-5" />
                Add item
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onAddFood(meal)}
            className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-outline-variant bg-white/10 px-8 py-10 text-center text-on-surface-variant/60 transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:min-h-28 md:rounded-xl"
          >
            <Utensils aria-hidden className="size-8" strokeWidth={1.5} />
            <span className="text-lg font-light">No items logged yet</span>
          </button>
        )}
      </div>
    </section>
  );
}
