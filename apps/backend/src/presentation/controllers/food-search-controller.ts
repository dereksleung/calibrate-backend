import { AuthenticationError } from "@application/errors/authentication-error.js";
import type { FoodCatalogSearchService } from "@application/services/food-catalog-search-service.js";
import { FoodSearchRequestQuerySchema, type FoodSearchRequestQuery } from "@calibrate/api-contracts";
import { handleControllerError } from "@common/errors/controller-error-handler.js";
import { validate } from "@validation/validation-helpers.js";
import type { Request, Response } from "express";

export class FoodSearchController {
  constructor(private readonly foodCatalogSearchService: Pick<FoodCatalogSearchService, "search">) {}

  async search(req: Request<Record<string, never>, unknown, unknown, FoodSearchRequestQuery>, res: Response): Promise<void> {
    try {
      const validatedQuery = validate(FoodSearchRequestQuerySchema, req.query);
      if (!validatedQuery.isValid) {
        res.status(400).json({ error: "Validation failed", details: validatedQuery.errors });
        return;
      }
      const userId = req.auth?.userId;
      if (!userId) throw new AuthenticationError("Authentication required");
      const response = await this.foodCatalogSearchService.search({ userId, ...validatedQuery.data });
      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}
