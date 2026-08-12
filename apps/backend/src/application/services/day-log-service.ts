import { DayLog } from "@domain/entities/day-log.js";
import { FoodEntry, MealNameEnumType } from "@domain/entities/food-entry.js";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";

import { IDayLogRepository } from "../ports/day-log-repository.js";
import { IUserRepository } from "../ports/user-repository.js";

export interface GetDayLogInput {
  userId: string;
  date: string;
}

export interface GetDayLogRangeInput {
  userId: string;
  startDate: string;
  endDate: string;
}

export interface AddFoodEntryInput {
  userId: string;
  date: string;
  foodEntry: {
    meal: MealNameEnumType;
    name: string;
    brand: string | null;
    iconName: string | null;
    chosenQuantity: number;
    chosenUnit: string;
    quantityServing: number;
    servingLabel: string;
    quantityMass: number | null;
    massUnit: string | null;
    quantityVolume: number | null;
    volumeUnit: string | null;
    calories: number;
    totalFatGrams: number;
    saturatedFatGrams: number | null;
    cholesterolMg: number | null;
    sodiumMg: number | null;
    totalCarbohydrateGrams: number;
    fiberGrams: number | null;
    sugarGrams: number | null;
    proteinGrams: number;
  };
}

export interface IDayLogService {
  getLogForDay({ userId, date }: GetDayLogInput): Promise<DayLog | null>;
  getLogsForDateRange({ userId, startDate, endDate }: GetDayLogRangeInput): Promise<DayLog[]>;
  addFoodEntry({ userId, date, foodEntry }: AddFoodEntryInput): Promise<FoodEntry>;
}

export class DayLogServiceImpl implements IDayLogService {
  private readonly dayLogRepository: IDayLogRepository;
  private readonly userRepository: IUserRepository;
  constructor(dayLogRepository: IDayLogRepository, userRepository: IUserRepository) {
    this.dayLogRepository = dayLogRepository;
    this.userRepository = userRepository;
  }

  async getLogForDay({ userId, date }: GetDayLogInput): Promise<DayLog | null> {
    return this.dayLogRepository.findLogByDateAndUserId({ userId, date });
  }

  async getLogsForDateRange({ userId, startDate, endDate }: GetDayLogRangeInput): Promise<DayLog[]> {
    return this.dayLogRepository.findLogsByDateRangeAndUserId({ userId, startDate, endDate });
  }

  async addFoodEntry({ userId, date, foodEntry }: AddFoodEntryInput): Promise<FoodEntry> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessLogicError("User not found");
    }

    const dayLogCount = await this.dayLogRepository.countDayLogsByUserId(userId);

    // Business rule: A user cannot have more than 7 day logs before subscribing
    // Service layer can coordinate and enforce business logic of other aggregates/entities
    if (!user.tier.isSubscribed() && dayLogCount > 7) {
      throw new BusinessLogicError("User has reached the maximum number of day logs before subscribing");
    }

    const dayLog = await this.dayLogRepository.findOrCreateByDateAndUserId({
      date,
      userId,
    });

    // Create a new food entry domain entity, applying the domain's validation rules
    const newFoodEntry = FoodEntry.create({
      ...foodEntry,
      dayLogId: dayLog.id,
    });

    // Apply domain aggregate's business rules - each day log has a maximum of 25 food entries per meal
    const entry = dayLog.addFoodEntry(newFoodEntry);
    const persistedEntry = await this.dayLogRepository.addFoodEntry(dayLog.id, entry);
    return persistedEntry;
  }
}
