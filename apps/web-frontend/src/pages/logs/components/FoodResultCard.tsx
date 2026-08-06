import { Plus } from "lucide-react";

import { cn } from "#/lib/utils.ts";
import type { SelectedFoodForConfirmation } from "../food-confirmation-state.ts";

type FoodResultCardProps = {
  food: SelectedFoodForConfirmation;
  onSelect: (food: SelectedFoodForConfirmation) => void;
};

export function FoodResultCard({ food, onSelect }: FoodResultCardProps) {
  const details = [
    `${Math.round(food.calories)} cal`,
    `${food.quantityServing} ${food.servingLabel}`,
    food.brand,
    food.lastUsedLabel,
  ].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        className={cn(
          "glass-card group flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left",
          "transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:translate-y-px",
        )}
        aria-label={`Select ${food.name}`}
        onClick={() => onSelect(food)}
      >
        <span className="min-w-0">
          <span className="block truncate font-heading text-base font-semibold text-on-surface">{food.name}</span>
          <span className="mt-1 block truncate text-sm text-on-surface-variant/80">{details}</span>
        </span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition group-hover:bg-primary-container">
          <Plus aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
      </button>
    </li>
  );
}
