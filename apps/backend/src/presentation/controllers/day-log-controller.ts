import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IDayLogService } from "@application/services/day-log-service.js";
import {
  CreateFoodEntryRequestRouteParams,
  CreateFoodEntryRequestRouteParamsSchema,
  CreateFoodEntryRequestSchema,
  DayLogRangeResponse,
  DayLogResponse,
  DayLogSyncRequest,
  DayLogSyncRequestSchema,
  DayLogSyncResponse,
  GetDayLogRangeRequestQuery,
  GetDayLogRangeRequestQuerySchema,
  GetDayLogRequestRouteParams,
  GetDayLogRequestRouteParamsSchema,
} from "@calibrate/api-contracts";
import { handleControllerError } from "@common/errors/controller-error-handler.js";
import { validate } from "@validation/validation-helpers.js";
import { Request, Response } from "express";

import { DayLogResponseMapper } from "../mappers/day-log-response-mapper.js";
import { FoodEntryResponseMapper } from "../mappers/food-entry-response-mapper.js";

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
  private readonly dayLogService: IDayLogService;
  constructor(dayLogService: IDayLogService) {
    this.dayLogService = dayLogService;
  }

  async getLogForDay(req: Request<GetDayLogRequestRouteParams>, res: Response): Promise<void> {
    try {
      const validatedInput = validate(GetDayLogRequestRouteParamsSchema, req.params);
      if (!validatedInput.isValid) {
        res.status(400).json({
          error: "Validation failed",
          details: validatedInput.errors,
        });
        return;
      }
      const authenticatedUserId = req.auth?.userId;
      if (!authenticatedUserId) {
        throw new AuthenticationError("Authentication required");
      }

      const dayLog = await this.dayLogService.getLogForDay({
        userId: authenticatedUserId,
        date: validatedInput?.data.date,
      });

      const response: DayLogResponse | null = dayLog ? DayLogResponseMapper.toResponse(dayLog) : null;
      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  async getLogsForDateRange(
    req: Request<Record<string, never>, unknown, unknown, GetDayLogRangeRequestQuery>,
    res: Response,
  ): Promise<void> {
    try {
      const validatedInput = validate(GetDayLogRangeRequestQuerySchema, req.query);
      if (!validatedInput.isValid) {
        res.status(400).json({
          error: "Validation failed",
          details: validatedInput.errors,
        });
        return;
      }

      const authenticatedUserId = req.auth?.userId;
      if (!authenticatedUserId) {
        throw new AuthenticationError("Authentication required");
      }

      const { startDate, endDate } = validatedInput.data;
      const dayLogs = await this.dayLogService.getLogsForDateRange({
        userId: authenticatedUserId,
        startDate,
        endDate,
      });
      const dayLogsByDate = new Map(dayLogs.map((dayLog) => [dayLog.date.toString(), dayLog]));
      const response: DayLogRangeResponse = {
        startDate,
        endDate,
        days: getConsecutiveDates(startDate, endDate).map((date) => {
          const dayLog = dayLogsByDate.get(date);
          return { date, dayLog: dayLog ? DayLogResponseMapper.toResponse(dayLog) : null };
        }),
      };

      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  async syncLogsForDateRange(
    req: Request<Record<string, never>, unknown, DayLogSyncRequest>,
    res: Response,
  ): Promise<void> {
    try {
      res.set("Cache-Control", "private, no-store");
      const validatedInput = validate(DayLogSyncRequestSchema, req.body);
      if (!validatedInput.isValid) {
        res.status(400).json({
          error: "Validation failed",
          details: validatedInput.errors,
        });
        return;
      }

      const authenticatedUserId = req.auth?.userId;
      if (!authenticatedUserId) {
        throw new AuthenticationError("Authentication required");
      }

      const result = await this.dayLogService.syncLogsForDateRange({
        userId: authenticatedUserId,
        startDate: validatedInput.data.startDate,
        endDate: validatedInput.data.endDate,
        known: validatedInput.data.known,
      });

      if (result.status === "unchanged") {
        res.status(204).end();
        return;
      }

      const response: DayLogSyncResponse = {
        slots: result.slots.map((slot) => ({
          date: slot.date,
          versionNumber: slot.versionNumber,
          dayLog: slot.dayLog ? DayLogResponseMapper.toResponse(slot.dayLog) : null,
        })),
      };
      res.status(200).json(response);
    } catch (error) {
      handleControllerError(error, res);
    }
  }

  async createFoodEntry(req: Request<CreateFoodEntryRequestRouteParams>, res: Response): Promise<void> {
    try {
      const validatedDate = validate(CreateFoodEntryRequestRouteParamsSchema, req.params);

      const validatedInput = validate(CreateFoodEntryRequestSchema, req.body);
      const errors = [];
      if (!validatedDate.isValid) errors.push(...validatedDate.errors);
      if (!validatedInput.isValid) errors.push(...validatedInput.errors);
      if (errors.length > 0) {
        res.status(400).json({
          error: "Validation failed",
          details: errors,
        });
        return;
      }

      if (!validatedDate.isValid || !validatedInput.isValid) return;

      const foodEntryInput = validatedInput.data;

      const authenticatedUserId = req.auth?.userId;
      if (!authenticatedUserId) {
        throw new AuthenticationError("Authentication required");
      }

      const entry = await this.dayLogService.addFoodEntry({
        userId: authenticatedUserId,
        foodEntry: {
          meal: foodEntryInput.meal,
          name: foodEntryInput.name,
          brand: foodEntryInput.brand,
          iconName: null,
          chosenQuantity: foodEntryInput.chosenQuantity,
          chosenUnit: foodEntryInput.chosenUnit,
          quantityServing: foodEntryInput.quantityServing,
          servingLabel: foodEntryInput.servingLabel,
          quantityMass: foodEntryInput.quantityMass,
          massUnit: foodEntryInput.massUnit,
          quantityVolume: foodEntryInput.quantityVolume,
          volumeUnit: foodEntryInput.volumeUnit,
          calories: foodEntryInput.calories,
          totalFatGrams: foodEntryInput.totalFatGrams,
          saturatedFatGrams: foodEntryInput.saturatedFatGrams,
          cholesterolMg: foodEntryInput.cholesterolMg,
          sodiumMg: foodEntryInput.sodiumMg,
          totalCarbohydrateGrams: foodEntryInput.totalCarbohydrateGrams,
          fiberGrams: foodEntryInput.fiberGrams,
          sugarGrams: foodEntryInput.sugarGrams,
          proteinGrams: foodEntryInput.proteinGrams,
        },
        date: validatedDate?.data.date,
      });
      res.status(201).json(FoodEntryResponseMapper.toResponse(entry));
    } catch (error) {
      handleControllerError(error, res);
    }
  }
}

function getConsecutiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const end = Temporal.PlainDate.from(endDate);
  let date = Temporal.PlainDate.from(startDate);

  while (Temporal.PlainDate.compare(date, end) <= 0) {
    dates.push(date.toString());
    date = date.add({ days: 1 });
  }

  return dates;
}
