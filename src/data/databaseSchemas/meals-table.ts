import {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
} from "kysely";
import { MealNameEnum } from "@models/meal.js";

type MealNameType =
  | MealNameEnum.BREAKFAST
  | MealNameEnum.LUNCH
  | MealNameEnum.DINNER
  | MealNameEnum.SNACKS;

export interface MealsTable {
  id: Generated<string>;
  name: ColumnType<MealNameType, string, never>;
}

export type SelectableMeal = Selectable<MealsTable>;
export type InsertableMeal = Insertable<MealsTable>;
export type UpdateableMeal = Updateable<MealsTable>;
