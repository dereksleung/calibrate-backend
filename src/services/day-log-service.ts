import { DayLogRepository } from "@data";
import { GetDayLogRequestDto, DayLog } from "@models";

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
    const dayLogPersistenceDto =
      await this.dayLogRepository.findLogByDateAndUserId({
        userId,
        date,
      });
    if (!dayLogPersistenceDto) return null;
    return DayLog.fromPersistence(dayLogPersistenceDto);
  }
}
