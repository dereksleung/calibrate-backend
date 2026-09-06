import type { IDayLogService } from "@application/services/day-log-service.js";
import type { RequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { DayLogSyncResponseSchema } from "@calibrate/api-contracts";
import { DayLog } from "@domain/entities/day-log.js";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DayLogController } from "../../controllers/day-log-controller.js";
import { createDayLogRoutes } from "../day-log-routes.js";

describe("day-log sync HTTP route", () => {
  const syncLogsForDateRange = vi.fn();
  const dayLogService = { syncLogsForDateRange } as Pick<IDayLogService, "syncLogsForDateRange">;
  const authenticationMiddleware: RequestHandler = (req, res, next) => {
    if (req.get("Authorization") !== "Bearer test-access") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    req.auth = { userId: "user-1" };
    next();
  };
  const app = express();
  app.use(express.json());
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

  beforeEach(() => {
    syncLogsForDateRange.mockReset();
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  it("rejects an unauthenticated sync request before controller execution", async () => {
    const response = await fetch(`${baseUrl}/api/v1/daylogs:sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2026-08-06", endDate: "2026-08-12", known: {} }),
    });

    expect(response.status).toBe(401);
    expect(syncLogsForDateRange).not.toHaveBeenCalled();
  });

  it("rejects a 32-date range and malformed manifests", async () => {
    const overlong = await fetch(`${baseUrl}/api/v1/daylogs:sync`, {
      method: "POST",
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2026-08-01", endDate: "2026-09-01", known: {} }),
    });
    const malformed = await fetch(`${baseUrl}/api/v1/daylogs:sync`, {
      method: "POST",
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-08-06",
        endDate: "2026-08-12",
        known: { "2026-08-01": 1 },
      }),
    });

    expect(overlong.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(syncLogsForDateRange).not.toHaveBeenCalled();
  });

  it("returns a bodyless no-store 204 when every requested slot matches", async () => {
    syncLogsForDateRange.mockResolvedValue({ status: "unchanged" });

    const response = await fetch(`${baseUrl}/api/v1/daylogs:sync`, {
      method: "POST",
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-08-06",
        endDate: "2026-08-12",
        known: { "2026-08-06": 1, "2026-08-12": null },
      }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("");
    expect(syncLogsForDateRange).toHaveBeenCalledWith({
      userId: "user-1",
      startDate: "2026-08-06",
      endDate: "2026-08-12",
      known: { "2026-08-06": 1, "2026-08-12": null },
    });
  });

  it("returns sparse no-store 200 slots for changed or unloaded dates", async () => {
    syncLogsForDateRange.mockResolvedValue({
      status: "changed",
      slots: [
        {
          date: "2026-08-12",
          versionNumber: 2,
          dayLog: DayLog.reconstitute({
            id: "00000000-0000-0000-0000-000000000000",
            date: Temporal.PlainDate.from("2026-08-12"),
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: [],
            weight: null,
            versionNumber: 2,
          }),
        },
        { date: "2026-08-07", versionNumber: null, dayLog: null },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/daylogs:sync`, {
      method: "POST",
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2026-08-06", endDate: "2026-08-12", known: {} }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(DayLogSyncResponseSchema.parse(await response.json())).toEqual({
      slots: [
        {
          date: "2026-08-12",
          versionNumber: 2,
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
        { date: "2026-08-07", versionNumber: null, dayLog: null },
      ],
    });
  });
});
