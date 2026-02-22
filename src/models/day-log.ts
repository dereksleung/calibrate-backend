import * as z from "zod";
import { MealSchema } from "@models/meal.js";

/**
 * The day log will be an aggregate root. It will be the public interface
 * for a number of related entities whose interfaces are found in this file, and will need those entities' info
 * to be strongly consistent for business rules to work correctly, and
 * not lead to an invalid system state.
 */

export const DayLogSchema = z.object({
  id: z.string(),
  date: z.iso.datetime(),
  breakfast: MealSchema,
  lunch: MealSchema,
  dinner: MealSchema,
  snacks: MealSchema,
  weight: z.number(),
});

export type DayLog = z.infer<typeof DayLogSchema>;

export const GetDayLogRequestRouteParamsSchema = z.iso.datetime();

export type GetDayLogRequestRouteParams = z.infer<
  typeof GetDayLogRequestRouteParamsSchema
>;

export type GetDayLogResponse = z.infer<typeof DayLogSchema>;
