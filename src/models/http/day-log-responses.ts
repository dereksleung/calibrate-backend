import { FoodEntryResponse } from "./food-entry-responses.js";

export interface DayLogResponse {
  id: string;
  date: Date;
  breakfast: FoodEntryResponse[] | null;
  lunch: FoodEntryResponse[] | null;
  dinner: FoodEntryResponse[] | null;
  snacks: FoodEntryResponse[] | null;
  weight: number | null;
}
