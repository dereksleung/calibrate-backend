import type { CreateFoodEntryRequest, MealNameEnumType } from "@calibrate/api-contracts";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { Button } from "#/shared/components/base/Button.tsx";
import type { FoodConfirmationState } from "../food-confirmation-state.ts";

type ConfirmFoodFormProps = {
  confirmation: FoodConfirmationState;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (entry: CreateFoodEntryRequest) => void;
};

const meals: Array<{ value: MealNameEnumType; label: string }> = [
  { value: "BREAKFAST", label: "Breakfast" }, { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" }, { value: "SNACKS", label: "Snacks" },
];

function servingUnits(food: FoodConfirmationState["food"]) {
  return [food.servingLabel, food.massUnit, food.volumeUnit].filter((unit): unit is string => Boolean(unit));
}

export function ConfirmFoodForm({ confirmation, isSaving, onCancel, onSave }: ConfirmFoodFormProps) {
  const { food } = confirmation;
  const units = servingUnits(food);
  const [quantity, setQuantity] = useState(String(food.quantityServing));
  const [unit, setUnit] = useState(units[0] ?? food.servingLabel);
  const [meal, setMeal] = useState<MealNameEnumType>(confirmation.preselectedMeal ?? "BREAKFAST");
  const [quantityError, setQuantityError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosenQuantity = Number(quantity);
    if (!Number.isFinite(chosenQuantity) || chosenQuantity <= 0) {
      setQuantityError("Enter an amount greater than 0.");
      return;
    }

    setQuantityError(null);
    onSave({
      name: food.name, brand: food.brand ?? null, meal, chosenQuantity, chosenUnit: unit,
      calories: food.calories, totalFatGrams: food.totalFatGrams, saturatedFatGrams: food.saturatedFatGrams,
      cholesterolMg: food.cholesterolMg, sodiumMg: food.sodiumMg, totalCarbohydrateGrams: food.totalCarbohydrateGrams,
      fiberGrams: food.fiberGrams, sugarGrams: food.sugarGrams, proteinGrams: food.proteinGrams,
      quantityServing: food.quantityServing, servingLabel: food.servingLabel, quantityMass: food.quantityMass,
      massUnit: food.massUnit, quantityVolume: food.quantityVolume, volumeUnit: food.volumeUnit,
    });
  }

  return (
    <main className="min-h-screen bg-surface px-6 pb-24 pt-6 antialiased md:px-10 md:pt-12 subtle-aurora-fade-page-background">
      <form className="mx-auto w-full max-w-2xl" onSubmit={submit}>
        <header className="flex items-center justify-between gap-4">
          <Button aria-label="Back to food search" type="button" variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="font-heading text-xl font-medium tracking-tight text-on-surface">Add Food</h1>
          <Button type="submit" size="sm" disabled={isSaving}>{isSaving ? "Saving…" : "Done"}</Button>
        </header>

        <section className="mt-9 rounded-2xl bg-surface-container-lowest px-6 py-6 shadow-[0_18px_45px_-32px_rgba(26,28,28,0.42)] ring-1 ring-on-surface/5">
          <p className="font-heading text-xl font-semibold text-on-surface">{food.name}</p>
          {food.brand ? <p className="mt-1 text-sm text-on-surface-variant">{food.brand}</p> : null}

          <div className="mt-7 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium tracking-wide text-on-surface-variant" htmlFor="food-quantity">
              Quantity
              <input id="food-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)}
                aria-invalid={Boolean(quantityError)} className="mt-2 h-12 w-full rounded-xl bg-surface-container-low px-4 text-base text-on-surface outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
            </label>
            <label className="text-xs font-medium tracking-wide text-on-surface-variant" htmlFor="serving-unit">
              Unit
              <select id="serving-unit" value={unit} onChange={(event) => setUnit(event.target.value)} className="mt-2 h-12 w-full rounded-xl bg-surface-container-low px-4 text-base text-on-surface outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                {units.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          {quantityError ? <p role="alert" className="mt-2 text-sm text-error">{quantityError}</p> : null}

          <fieldset className="mt-7">
            <legend className="text-xs font-medium tracking-wide text-on-surface-variant">Meal</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {meals.map((option) => (
                <button key={option.value} type="button" onClick={() => setMeal(option.value)} aria-pressed={meal === option.value}
                  className="rounded-full bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 aria-pressed:bg-primary aria-pressed:text-on-primary">
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="mt-6 rounded-2xl bg-surface-container-low px-6 py-5" aria-labelledby="nutrition-heading">
          <div className="flex items-baseline justify-between gap-4"><h2 id="nutrition-heading" className="font-heading text-lg text-on-surface">Nutrition</h2><p className="text-2xl font-semibold text-on-surface">{Math.round(food.calories)} cal</p></div>
          <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-on-surface-variant">Protein</dt><dd className="mt-1 font-medium text-on-surface">{food.proteinGrams}g</dd></div>
            <div><dt className="text-on-surface-variant">Carbs</dt><dd className="mt-1 font-medium text-on-surface">{food.totalCarbohydrateGrams}g</dd></div>
            <div><dt className="text-on-surface-variant">Fat</dt><dd className="mt-1 font-medium text-on-surface">{food.totalFatGrams}g</dd></div>
          </dl>
        </section>

        <details className="mt-6 rounded-2xl bg-surface-container-lowest px-6 py-5 text-sm text-on-surface-variant">
          <summary className="cursor-pointer font-medium text-on-surface">Nutrition facts</summary>
          <dl className="mt-4 space-y-2"><div className="flex justify-between"><dt>Sodium</dt><dd>{food.sodiumMg ?? 0}mg</dd></div><div className="flex justify-between"><dt>Fiber</dt><dd>{food.fiberGrams ?? 0}g</dd></div><div className="flex justify-between"><dt>Sugar</dt><dd>{food.sugarGrams ?? 0}g</dd></div></dl>
        </details>
      </form>
    </main>
  );
}
