import { DayLogController } from "@controllers";
import { DayLogService, DayLogServiceImpl } from "@services";
import { DayLogRepository } from "@application";
import { PostgresDayLogRepository } from "./persistence/repositories/index.js";

export class Container {
  private readonly dayLogRepository: DayLogRepository;
  private readonly dayLogService: DayLogService;
  private readonly dayLogController: DayLogController;

  constructor({
    dayLogRepository,
    dayLogService,
    dayLogController,
  }: {
    dayLogRepository?: DayLogRepository;
    dayLogService?: DayLogService;
    dayLogController?: DayLogController;
  }) {
    this.dayLogRepository = dayLogRepository ?? new PostgresDayLogRepository();
    this.dayLogService =
      dayLogService ?? new DayLogServiceImpl(this.dayLogRepository);
    this.dayLogController =
      dayLogController ?? new DayLogController(this.dayLogService);
  }

  getDayLogService(): DayLogService {
    return this.dayLogService;
  }
  getDayLogRepository(): DayLogRepository {
    return this.dayLogRepository;
  }
  getDayLogController(): DayLogController {
    return this.dayLogController;
  }
}
