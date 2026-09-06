import type {
  CreateFoodEntryRequestRouteParams,
  DayLogSyncRequest,
  GetDayLogRangeRequestQuery,
  GetDayLogRequestRouteParams,
} from "@calibrate/api-contracts";

import { Request, RequestHandler, Router } from "express";
import { DayLogController } from "src/presentation/controllers/day-log-controller.js";

export function createDayLogRoutes(
  dayLogController: DayLogController,
  authenticationMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.post("/daylogs:sync", authenticationMiddleware, (req, res) =>
    dayLogController.syncLogsForDateRange(
      req as Request<Record<string, never>, unknown, DayLogSyncRequest>,
      res,
    ),
  );
  router.get("/daylogs", authenticationMiddleware, (req, res) =>
    dayLogController.getLogsForDateRange(
      req as Request<Record<string, never>, unknown, unknown, GetDayLogRangeRequestQuery>,
      res,
    ),
  );
  router.get("/daylogs/:date", authenticationMiddleware, (req, res) =>
    dayLogController.getLogForDay(req as Request<GetDayLogRequestRouteParams>, res),
  );
  router.post("/daylogs/:date/food-entries", authenticationMiddleware, (req, res) =>
    dayLogController.createFoodEntry(req as Request<CreateFoodEntryRequestRouteParams>, res),
  );
  return router;
}
