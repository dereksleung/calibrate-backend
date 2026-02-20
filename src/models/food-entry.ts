import * as z from 'zod';

export const CommonFoodEntryFieldsSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  iconName: z.string().optional(),
  quantity: z.number(),
  quantityUnit: z.string(),
  calories: z.number(),
  totalFatGrams: z.number(),
  saturatedFatGrams: z.number().optional(),
  cholesterolMg: z.number().optional(),
  sodiumMg: z.number().optional(),
  totalCarbohydrateGrams: z.number(),
  fiberGrams: z.number().optional(),
  sugarGrams: z.number().optional(),
  proteinGrams: z.number(),
})

export const FoodEntrySchema = z.object({
  ...CommonFoodEntryFieldsSchema.shape,
  id: z.string(),
});

/**
 * Rather than rely on the food entity searchable in the catalog by using its ID, 
 * because other users can edit that food entity before a user creates their food entry based on it,
 * we should create the user's food entry based on the nutrition info 
 * the user saw when they browsed the catalog entry.
 */
export interface CreateFoodEntryRequest extends z.infer<typeof CommonFoodEntryFieldsSchema> {}

export type CreateFoodEntryResponse = z.infer<typeof FoodEntrySchema>;