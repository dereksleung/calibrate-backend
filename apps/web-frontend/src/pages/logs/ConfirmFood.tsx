import type { FoodConfirmationState } from "./food-confirmation-state.ts";

type ConfirmFoodProps = {
  confirmation: FoodConfirmationState;
};

/** The editable confirmation form is added in the next Story 5 slice. */
export function ConfirmFood({ confirmation }: ConfirmFoodProps) {
  return (
    <main className="min-h-screen bg-surface px-6 py-8 antialiased md:px-10 md:py-16 subtle-aurora-fade-page-background">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-normal tracking-tight text-on-surface">Add Food</h1>
          <span className="text-sm text-on-surface-variant">Done</span>
        </header>
        <p className="mt-10 font-heading text-xl text-on-surface">{confirmation.food.name}</p>
      </div>
    </main>
  );
}
