import type { FoodSearchRequestQuery } from "@calibrate/api-contracts";
import type { FoodSearchController } from "@controllers/food-search-controller.js";
import { Request, type RequestHandler, Router } from "express";

export function createFoodSearchRoutes(controller: FoodSearchController, authenticationMiddleware: RequestHandler): Router {
  const router = Router();
  router.get("/foods/search", authenticationMiddleware, (req, res) =>
    controller.search(req as unknown as Request<Record<string, never>, unknown, unknown, FoodSearchRequestQuery>, res),
  );
  return router;
}
