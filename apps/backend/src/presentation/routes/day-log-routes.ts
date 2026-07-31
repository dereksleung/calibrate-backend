import type {
  CreateFoodEntryRequestRouteParams,
  GetDayLogRequestRouteParams,
} from "@calibrate/api-contracts";

import { Request, RequestHandler, Router } from "express";
import { DayLogController } from "src/presentation/controllers/day-log-controller.js";

export function createDayLogRoutes(
  dayLogController: DayLogController,
  authenticationMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.get("/daylogs/:date", authenticationMiddleware, (req, res) =>
    dayLogController.getLogForDay(req as Request<GetDayLogRequestRouteParams>, res),
  );
  router.post("/daylogs/:date/food-entries", authenticationMiddleware, (req, res) =>
    dayLogController.createFoodEntry(req as Request<CreateFoodEntryRequestRouteParams>, res),
  );
  return router;
}
