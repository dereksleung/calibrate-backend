import * as z from "zod";

export const MealNameSchema = z.enum([
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACKS",
]);

export const MealNameEnum = MealNameSchema.enum;

export type MealNameEnumType = z.infer<typeof MealNameSchema>;

export const CommonFoodEntryFieldsSchema = z.object({
  meal: MealNameSchema,
  name: z.string(),
  brand: z.string().nullable(),
  iconName: z.string().nullable(),
  quantity: z.number(),
  quantityUnit: z.string(),
  calories: z.number(),
  totalFatGrams: z.number(),
  saturatedFatGrams: z.number().nullable(),
  cholesterolMg: z.number().nullable(),
  sodiumMg: z.number().nullable(),
  totalCarbohydrateGrams: z.number(),
  fiberGrams: z.number().nullable(),
  sugarGrams: z.number().nullable(),
  proteinGrams: z.number(),
});

export const FoodEntrySchema = z.object({
  ...CommonFoodEntryFieldsSchema.shape,
  id: z.string(),
});

export type FoodEntry = z.infer<typeof FoodEntrySchema>;

/**
 * Rather than rely on the food entity searchable in the catalog by using its ID,
 * because other users can edit that food entity before a user creates their food entry based on it,
 * we should create the user's food entry based on the nutrition info
 * the user saw when they browsed the catalog entry.
 */
export interface CreateFoodEntryRequest extends z.infer<
  typeof CommonFoodEntryFieldsSchema
> {}

export type CreateFoodEntryResponse = z.infer<typeof FoodEntrySchema>;
