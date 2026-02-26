import {
  GetDayLogRequestRouteParams,
  GetDayLogRequestRouteParamsSchema,
  DayLogResponse,
} from "@models";
import { Request, Response } from "express";
import { DayLogService } from "src/services/day-log-service.js";
import { validate } from "@validation/validation-helpers.js";
import { DayLogMapper } from "src/models/mappers/day-log-mapper.js";

/**
 * The controller has one main job - go between HTTP, and my application.
 * It should:
 * - Validate and sanitize input,
 * - Call the appropriate service, which will provide an interface for actions coordinating operations on aggregates/entities,
 * - Format the response,
 * - Handle errors related to HTTP.
 * It should not handle business logic, database access, or complex formatting.
 */

export class DayLogController {
  private readonly dayLogService: DayLogService;
  constructor(dayLogService: DayLogService) {
    this.dayLogService = dayLogService;
  }

  async getLogForDay(
    req: Request<{ date: GetDayLogRequestRouteParams }>,
    res: Response,
  ): Promise<void> {
    try {
      const validatedInput = validate(
        GetDayLogRequestRouteParamsSchema,
        req.params.date,
      );
      if (!validatedInput.isValid) {
        res.status(400).json({
          error: "Validation failed",
          details: validatedInput.errors,
        });
        return;
      }
      const userId = this.extractUserId(req);
      const dayLog = await this.dayLogService.getLogForDay({
        userId,
        date: validatedInput?.data,
      });

      const response: DayLogResponse | null = dayLog
        ? DayLogMapper.toResponse(dayLog)
        : null;
      res.status(200).json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  }
  private handleError(error: unknown, res: Response): void {
    console.error("DayLogController error:", error);
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      if (error.message.includes("permission")) {
        res.status(403).json({ error: "Permission denied" });
        return;
      }
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
  private extractUserId(req: Request): string {
    return (req.get("user-id") as string) || "default-user";
  }
}
