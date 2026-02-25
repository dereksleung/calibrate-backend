import * as z from "zod";
import { FoodEntrySchema } from "./food-entry.js";

export enum MealNameEnum {
  BREAKFAST = "BREAKFAST",
  LUNCH = "LUNCH",
  DINNER = "DINNER",
  SNACKS = "SNACKS",
}

export const MealNameSchema = z.enum([
  MealNameEnum.BREAKFAST,
  MealNameEnum.LUNCH,
  MealNameEnum.DINNER,
  MealNameEnum.SNACKS,
]);

export const MealSchema = z.object({
  id: z.string(),
  name: MealNameSchema,
  foods: z.array(FoodEntrySchema),
});

export type Meal = z.infer<typeof MealSchema>;
