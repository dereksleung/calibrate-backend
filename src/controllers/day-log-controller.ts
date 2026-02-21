import { GetDayLogResponse } from "@models/day-log.js";
import { Request, Response } from 'express';
import { DayLogService } from "src/services/day-log-service.js";

export class DayLogController {
  private readonly dayLogService: DayLogService;
  constructor(dayLogService: DayLogService) {
    this.dayLogService = dayLogService;
  }
  
  async getLogForDay(req: Request, res: Response): Promise<void> {
    try {
      const dayLog = await this.dayLogService.getLogForDay(req.body);

      const response: GetDayLogResponse = {
        ...dayLog,
      };
      res.status(200).json(response);
    } catch (error) {
      this.handleError(error, res);
    }
  }
  private handleError(error: unknown, res: Response): void {
    console.error('Controller error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Resource not found' });
        return;
      }
      if (error.message.includes('permission')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}