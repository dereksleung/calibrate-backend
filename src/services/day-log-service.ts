import { DayLogRepository } from "@data";
import { DayLog } from "@models/day-log.js";

export interface DayLogService {
  getLogForDay({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | null>;
}

export class DayLogServiceImpl implements DayLogService {
  private readonly dayLogRepository: DayLogRepository;
  constructor(dayLogRepository: DayLogRepository) {
    this.dayLogRepository = dayLogRepository;
  }

  async getLogForDay({
    userId,
    date,
  }: {
    userId: string;
    date: string;
  }): Promise<DayLog | null> {
    const dayLog = await this.dayLogRepository.findLogByDateAndUserId({
      userId,
      date,
    });
    return dayLog;
  }
}
