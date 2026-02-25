import { Router } from "express";
import { DayLogController } from "@controllers/day-log-controller.js";

export function createDayLogRoutes(dayLogController: DayLogController): Router {
  const router = Router();

  router.get("/daylogs/:date", (req, res) =>
    dayLogController.getLogForDay(req, res),
  );
  return router;
}
