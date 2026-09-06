import * as z from "zod";

import { DayLogVersionNumberSchema } from "./day-log-requests.js";
import { FoodEntryResponseSchema } from "./food-entry-responses.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function dateAtOffset(startDate: string, offset: number): string {
  return new Date(toUtcTimestamp(startDate) + offset * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export const DayLogResponseSchema = z
  .object({
    id: z.uuid(),
    date: z.iso.date(),
    breakfast: z.array(FoodEntryResponseSchema).nullable(),
    lunch: z.array(FoodEntryResponseSchema).nullable(),
    dinner: z.array(FoodEntryResponseSchema).nullable(),
    snacks: z.array(FoodEntryResponseSchema).nullable(),
    weight: z.number().positive().max(9999.9).nullable(),
  })
  .nullable();

export type DayLogResponse = z.infer<typeof DayLogResponseSchema>;

export const DayLogRangeDayResponseSchema = z.object({
  date: z.iso.date(),
  dayLog: DayLogResponseSchema,
});

export type DayLogRangeDayResponse = z.infer<typeof DayLogRangeDayResponseSchema>;

export const DayLogRangeResponseSchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    days: z.array(DayLogRangeDayResponseSchema),
  })
  .superRefine(({ startDate, endDate, days }, context) => {
    const dayCount = (toUtcTimestamp(endDate) - toUtcTimestamp(startDate)) / MILLISECONDS_PER_DAY + 1;

    if (dayCount < 1 || dayCount > 7 || days.length !== dayCount) {
      context.addIssue({
        code: "custom",
        path: ["days"],
        message: "days must contain one slot for every requested date",
      });
      return;
    }

    for (const [index, day] of days.entries()) {
      const expectedDate = dateAtOffset(startDate, index);

      if (day.date !== expectedDate) {
        context.addIssue({
          code: "custom",
          path: ["days", index, "date"],
          message: "days must be ordered consecutive dates matching the requested range",
        });
      }

      if (day.dayLog && day.dayLog.date !== day.date) {
        context.addIssue({
          code: "custom",
          path: ["days", index, "dayLog", "date"],
          message: "dayLog date must match its date slot",
        });
      }
    }
  });

export type DayLogRangeResponse = z.infer<typeof DayLogRangeResponseSchema>;

export const DayLogSyncSlotSchema = z
  .object({
    date: z.iso.date(),
    versionNumber: DayLogVersionNumberSchema.nullable(),
    dayLog: DayLogResponseSchema,
  })
  .superRefine((slot, context) => {
    if (slot.dayLog === null && slot.versionNumber !== null) {
      context.addIssue({
        code: "custom",
        path: ["versionNumber"],
        message: "Known-empty slots must have a null versionNumber",
      });
    }

    if (slot.dayLog !== null && slot.versionNumber === null) {
      context.addIssue({
        code: "custom",
        path: ["versionNumber"],
        message: "Present day logs must include a versionNumber",
      });
    }

    if (slot.dayLog && slot.dayLog.date !== slot.date) {
      context.addIssue({
        code: "custom",
        path: ["dayLog", "date"],
        message: "dayLog date must match its date slot",
      });
    }
  });

export type DayLogSyncSlot = z.infer<typeof DayLogSyncSlotSchema>;

export const DayLogSyncResponseSchema = z.object({
  slots: z.array(DayLogSyncSlotSchema),
});

export type DayLogSyncResponse = z.infer<typeof DayLogSyncResponseSchema>;
