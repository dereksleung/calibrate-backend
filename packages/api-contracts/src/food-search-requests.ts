import * as z from "zod";

export const FoodSearchRequestQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, "Search query must be at least 3 characters")
    .max(100, "Search query is too long")
    .refine((value) => value.split(/\s+/).length <= 8, "Search query contains too many terms"),
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(20),
});

export type FoodSearchRequestQuery = z.infer<typeof FoodSearchRequestQuerySchema>;
