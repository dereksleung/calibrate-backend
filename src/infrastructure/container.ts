import { DayLogController } from "@controllers/day-log-controller.js";
import { DayLogService, DayLogServiceImpl } from "@services/day-log-service.js";
import { DayLogRepository, PostgresDayLogRepository } from "@data";

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
