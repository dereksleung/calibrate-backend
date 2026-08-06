import { describe, expect, it } from "vitest";

import { PostgresDayLogRepository } from "../postgres-day-log-repository.js";

describe("PostgresDayLogRepository", () => {
  it("creates a missing day log for the requested calendar date", async () => {
    let insertedValues: Record<string, unknown> | undefined;
    const queriedDates: unknown[] = [];
    const insertedRow = {
      id: "day-log-1", date: "2026-05-18", user_id: "user-1", weight: null,
      created_at: new Date(), updated_at: new Date(),
    };
    const databaseClient = {
      selectFrom: () => ({
        selectAll: () => ({
          where: () => ({
            where: (_column: string, _operator: string, date: unknown) => {
              queriedDates.push(date);
              return { executeTakeFirst: async () => undefined };
            },
            execute: async () => [],
          }),
        }),
      }),
      insertInto: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values;
          return { returningAll: () => ({ executeTakeFirst: async () => insertedRow }) };
        },
      }),
    };
    const repository = new PostgresDayLogRepository(databaseClient as never);

    const dayLog = await repository.findOrCreateByDateAndUserId({ userId: "user-1", date: "2026-05-18" });

    expect(dayLog.id).toBe("day-log-1");
    expect(insertedValues).toMatchObject({ user_id: "user-1", weight: null });
    expect(insertedValues?.date).toBe("2026-05-18");
    expect(queriedDates).toEqual(["2026-05-18"]);
  });
});
