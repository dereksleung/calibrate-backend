import * as z from "zod";

export const MAX_DAY_LOG_SYNC_DATES = 31;
export const MAX_DAY_LOG_VERSION_NUMBER = 2_147_483_647;

export const DayLogVersionNumberSchema = z.number().int().positive().max(MAX_DAY_LOG_VERSION_NUMBER);

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

export const DayLogSyncRequestSchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    known: z.record(z.iso.date(), DayLogVersionNumberSchema.nullable()),
  })
  .superRefine(({ startDate, endDate, known }, context) => {
    const dayCount = (toUtcTimestamp(endDate) - toUtcTimestamp(startDate)) / MILLISECONDS_PER_DAY + 1;

    if (dayCount < 1) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be on or after startDate",
      });
      return;
    }

    if (dayCount > MAX_DAY_LOG_SYNC_DATES) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Date range cannot exceed ${MAX_DAY_LOG_SYNC_DATES} dates`,
      });
      return;
    }

    const rangeStart = toUtcTimestamp(startDate);
    const rangeEnd = toUtcTimestamp(endDate);

    for (const date of Object.keys(known)) {
      const timestamp = toUtcTimestamp(date);
      if (timestamp < rangeStart || timestamp > rangeEnd) {
        context.addIssue({
          code: "custom",
          path: ["known", date],
          message: "known dates must fall within startDate and endDate",
        });
      }
    }
  });

export type DayLogSyncRequest = z.infer<typeof DayLogSyncRequestSchema>;
