import * as z from 'zod';
import { FoodEntrySchema } from './food-entry.js';

export const MealSchema = z.object({
  id: z.string(),
  name: z.string(),
  foods: z.array(FoodEntrySchema),
});

export type Meal = z.infer<typeof MealSchema>;