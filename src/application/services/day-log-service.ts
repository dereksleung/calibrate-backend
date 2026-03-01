import { DayLog } from "@domain";
import { GetDayLogRequestDto } from "../dtos/day-log-dtos.js";
import { DayLogRepository } from "../ports/day-log-repository.js";

export interface DayLogService {
  getLogForDay({ userId, date }: GetDayLogRequestDto): Promise<DayLog | null>;
}

export class DayLogServiceImpl implements DayLogService {
  private readonly dayLogRepository: DayLogRepository;
  constructor(dayLogRepository: DayLogRepository) {
    this.dayLogRepository = dayLogRepository;
  }

  async getLogForDay({
    userId,
    date,
  }: GetDayLogRequestDto): Promise<DayLog | null> {
    return this.dayLogRepository.findLogByDateAndUserId({ userId, date });
  }
}
