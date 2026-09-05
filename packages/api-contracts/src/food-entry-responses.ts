import * as z from "zod";

import { DayLogVersionNumberSchema } from "./day-log-requests.js";
import {
  FoodEntryBaseSchema,
  FoodEntryChosenFieldsSchema,
  MealNameSchema,
} from "./common/food-entry-base.js";

export const FoodEntryResponseSchema = FoodEntryBaseSchema.extend(FoodEntryChosenFieldsSchema.shape).extend({
  id: z.string().min(1),
  meal: MealNameSchema,
});

export type FoodEntryResponse = z.infer<typeof FoodEntryResponseSchema>;

export const CreateFoodEntryResponseSchema = FoodEntryResponseSchema.extend({
  versionNumber: DayLogVersionNumberSchema,
});

export type CreateFoodEntryResponse = z.infer<typeof CreateFoodEntryResponseSchema>;
