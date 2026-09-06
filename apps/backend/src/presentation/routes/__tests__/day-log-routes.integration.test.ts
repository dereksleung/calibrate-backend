import type { IDayLogService } from "@application/services/day-log-service.js";
import type { RequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { DayLogRangeResponseSchema } from "@calibrate/api-contracts";
import { DayLog } from "@domain/entities/day-log.js";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DayLogController } from "../../controllers/day-log-controller.js";
import { createDayLogRoutes } from "../day-log-routes.js";

describe("day-log range HTTP route", () => {
  const getLogsForDateRange = vi.fn();
  const dayLogService = { getLogsForDateRange } as Pick<IDayLogService, "getLogsForDateRange">;
  const authenticationMiddleware: RequestHandler = (req, res, next) => {
    if (req.get("Authorization") !== "Bearer test-access") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    req.auth = { userId: "user-1" };
    next();
  };
  const app = express();
  app.use(
    "/api/v1",
    createDayLogRoutes(new DayLogController(dayLogService as IDayLogService), authenticationMiddleware),
  );
  let server: Server;
  let baseUrl: string;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  it("rejects an unauthenticated date-range request before controller execution", async () => {
    const response = await fetch(`${baseUrl}/api/v1/daylogs?startDate=2026-08-06&endDate=2026-08-12`);

    expect(response.status).toBe(401);
    expect(getLogsForDateRange).not.toHaveBeenCalled();
  });

  it("uses the authenticated user to return a schema-valid date range", async () => {
    getLogsForDateRange.mockResolvedValue([
      DayLog.reconstitute({
        id: "00000000-0000-0000-0000-000000000000",
        date: Temporal.PlainDate.from("2026-08-12"),
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
        weight: null,
        versionNumber: 1,
      }),
    ]);

    const response = await fetch(`${baseUrl}/api/v1/daylogs?startDate=2026-08-06&endDate=2026-08-12`, {
      headers: { Authorization: "Bearer test-access" },
    });

    expect(response.status).toBe(200);
    expect(getLogsForDateRange).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-08-06",
      endDate: "2026-08-12",
    });
    expect(DayLogRangeResponseSchema.parse(await response.json())).toEqual({
      startDate: "2026-08-06",
      endDate: "2026-08-12",
      days: [
        { date: "2026-08-06", dayLog: null },
        { date: "2026-08-07", dayLog: null },
        { date: "2026-08-08", dayLog: null },
        { date: "2026-08-09", dayLog: null },
        { date: "2026-08-10", dayLog: null },
        { date: "2026-08-11", dayLog: null },
        {
          date: "2026-08-12",
          dayLog: {
            id: "00000000-0000-0000-0000-000000000000",
            date: "2026-08-12",
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: [],
            weight: null,
          },
        },
      ],
    });
  });
});
