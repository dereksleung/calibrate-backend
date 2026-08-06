import { useState } from "react";

import type { FoodConfirmationState } from "./food-confirmation-state.ts";
import { FoodSearchPage } from "./components/FoodSearchPage.tsx";

type FoodSearchProps = {
  preselectedMeal?: FoodConfirmationState["preselectedMeal"];
};

export function FoodSearch({ preselectedMeal }: FoodSearchProps) {
  const [selectedFood, setSelectedFood] = useState<FoodConfirmationState | null>(null);

  return (
    <>
      <FoodSearchPage
        onSelectFood={(state) => setSelectedFood({ ...state, preselectedMeal })}
      />
      {selectedFood ? (
        <p role="status" className="sr-only">
          {`${selectedFood.food.name} selected for confirmation.`}
        </p>
      ) : null}
    </>
  );
}
