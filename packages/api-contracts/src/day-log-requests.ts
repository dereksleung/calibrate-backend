import * as z from "zod";

export const GetDayLogRequestRouteParamsSchema = z.object({
  date: z.iso.date(),
});

export type GetDayLogRequestRouteParams = z.infer<typeof GetDayLogRequestRouteParamsSchema>;

const MAX_DAY_LOG_RANGE_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

export const GetDayLogRangeRequestQuerySchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .superRefine(({ startDate, endDate }, context) => {
    const dayCount = (toUtcTimestamp(endDate) - toUtcTimestamp(startDate)) / MILLISECONDS_PER_DAY + 1;

    if (dayCount < 1) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be on or after startDate",
      });
    } else if (dayCount > MAX_DAY_LOG_RANGE_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Date range cannot exceed ${MAX_DAY_LOG_RANGE_DAYS} days`,
      });
    }
  });

export type GetDayLogRangeRequestQuery = z.infer<typeof GetDayLogRangeRequestQuerySchema>;

export const UpdateDayLogWeightRequestRouteParamsSchema = z.object({
  date: z.iso.date(),
});

export const UpdateDayLogWeightRequestBodySchema = z.object({
  weight: z.number().positive("Weight must be greater than 0").max(9999.9, "Weight is too large"),
});

export type UpdateDayLogWeightRequestRouteParams = z.infer<typeof UpdateDayLogWeightRequestRouteParamsSchema>;
export type UpdateDayLogWeightRequestBody = z.infer<typeof UpdateDayLogWeightRequestBodySchema>;
