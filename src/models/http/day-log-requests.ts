import * as z from "zod";

export const GetDayLogRequestRouteParamsSchema = z.iso.datetime();

export type GetDayLogRequestRouteParams = z.infer<
  typeof GetDayLogRequestRouteParamsSchema
>;
