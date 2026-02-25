import { MealNameEnumType } from "@models/food-entry.js";
import {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
} from "kysely";

export interface FoodEntriesTable {
  id: Generated<string>;
  day_log_id: string;
  meal: MealNameEnumType;
  name: string;
  brand: string | null;
  icon_name: string | null;
  quantity: number;
  quantity_unit: string;
  calories: number;
  total_fat_grams: number;
  saturated_fat_grams: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  total_carbohydrate_grams: number;
  fiber_grams: number | null;
  sugar_grams: number | null;
  protein_grams: number;
  created_at: ColumnType<Date, string, never>;
  updated_at: ColumnType<Date, string, Date>;
}

export type SelectableFoodEntry = Selectable<FoodEntriesTable>;
export type InsertableFoodEntry = Insertable<FoodEntriesTable>;
export type UpdateableFoodEntry = Updateable<FoodEntriesTable>;
