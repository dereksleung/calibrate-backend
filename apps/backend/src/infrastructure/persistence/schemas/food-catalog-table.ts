import { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export interface FoodCatalogTable {
  id: Generated<string>;
  name: string;
  brand: string | null;
  quantity_serving: number;
  serving_label: string;
  quantity_mass: number | null;
  mass_unit: string | null;
  quantity_volume: number | null;
  volume_unit: string | null;
  calories: number;
  total_fat_grams: number;
  saturated_fat_grams: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  total_carbohydrate_grams: number;
  fiber_grams: number | null;
  sugar_grams: number | null;
  protein_grams: number;
  source: string;
  source_food_id: string;
  normalized_gtin: string | null;
  verification_state: string;
  search_text: string;
  search_vector: unknown;
  popularity: number;
  created_at: ColumnType<Date, string, never>;
  updated_at: ColumnType<Date, string, Date>;
}

export type SelectableFoodCatalog = Selectable<FoodCatalogTable>;
export type InsertableFoodCatalog = Insertable<FoodCatalogTable>;
export type UpdateableFoodCatalog = Updateable<FoodCatalogTable>;
