import { Router } from "express";
import { DayLogController } from "@controllers/day-log-controller.js";
import { DayLogServiceImpl } from "@services/day-log-service.js";

export function createDayLogRoutes(): Router {
  const router = Router();

  // TODO: Later will create a DI container to wire everything together.
  const dayLogService = new DayLogServiceImpl();
  const dayLogController = new DayLogController(dayLogService);
  router.get("/daylogs/:date", (req, res) =>
    dayLogController.getLogForDay(req, res),
  );
  return router;
}
