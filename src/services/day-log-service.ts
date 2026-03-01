import { DayLogRepository } from "@data";
import { DayLog } from "@models";
import { GetDayLogRequestDto } from "./dtos/day-log-dtos.js";
import { DayLogPersistenceMapper } from "./mappers/day-log-persistence-mapper.js";

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
    return DayLogPersistenceMapper.toDomain(dayLogPersistenceDto);
  }
}
