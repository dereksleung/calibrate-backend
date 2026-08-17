import type { CreateFoodEntryRequest } from "@calibrate/api-contracts";
import { ConfirmFoodForm } from "./components/ConfirmFoodForm.tsx";
import type { FoodConfirmationState } from "../food-confirmation-state.ts";

type ConfirmFoodProps = {
  confirmation: FoodConfirmationState;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (entry: CreateFoodEntryRequest) => void;
};

/** The editable confirmation form is added in the next Story 5 slice. */
export function ConfirmFood({ confirmation, isSaving, onCancel, onSave }: ConfirmFoodProps) {
  return <ConfirmFoodForm confirmation={confirmation} isSaving={isSaving} onCancel={onCancel} onSave={onSave} />;
}
