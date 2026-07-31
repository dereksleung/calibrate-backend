import { BusinessLogicError } from "@domain/errors/business-logic-error.js";

import { FoodEntry, MealNameEnum, MealNameEnumType } from "./food-entry.js";

/**
 * The day log will be an aggregate root. It will be the public interface
 * for child entities, and will need those entities' info
 * to be strongly consistent for business rules to work correctly, and
 * not lead to an invalid system state.
 */

export interface DayLogProps {
  id: string;
  date: Date | Temporal.PlainDate;
  breakfast: FoodEntry[];
  lunch: FoodEntry[];
  dinner: FoodEntry[];
  snacks: FoodEntry[];
  weight: number | null;
}

export class DayLog {
  private readonly _id: string;
  private readonly _date: Temporal.PlainDate;
  private _breakfast: FoodEntry[];
  private _lunch: FoodEntry[];
  private _dinner: FoodEntry[];
  private _snacks: FoodEntry[];
  private _weight: number | null;

  private constructor({ id, date, breakfast, lunch, dinner, snacks, weight }: DayLogProps) {
    this._id = id;
    this._date = Temporal.PlainDate.from(date instanceof Date
      ? {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate(),
        }
      : date);
    this._breakfast = breakfast;
    this._lunch = lunch;
    this._dinner = dinner;
    this._snacks = snacks;
    this._weight = weight ?? null;
  }

  public static reconstitute(props: DayLogProps): DayLog {
    return new DayLog(props);
  }

  public addFoodEntry(foodEntry: FoodEntry): FoodEntry {
    const meal = this.getMealArray(foodEntry.meal);
    if (meal && meal.length >= 25) {
      throw new BusinessLogicError("Meal cannot exceed 25 food entries");
    }
    switch (foodEntry.meal) {
      case MealNameEnum.BREAKFAST:
        this._breakfast?.push(foodEntry);
        break;
      case MealNameEnum.LUNCH:
        this._lunch?.push(foodEntry);
        break;
      case MealNameEnum.DINNER:
        this._dinner?.push(foodEntry);
        break;
      case MealNameEnum.SNACKS:
        this._snacks?.push(foodEntry);
        break;
    }

    return foodEntry;
  }

  private getMealArray(meal: MealNameEnumType): FoodEntry[] | null {
    switch (meal) {
      case MealNameEnum.BREAKFAST:
        return this._breakfast;
      case MealNameEnum.LUNCH:
        return this._lunch;
      case MealNameEnum.DINNER:
        return this._dinner;
      case MealNameEnum.SNACKS:
        return this._snacks;
    }
  }

  public get id(): string {
    return this._id;
  }
  public get date(): Temporal.PlainDate {
    return this._date;
  }
  public get breakfast(): FoodEntry[] | null {
    return this._breakfast;
  }
  public get lunch(): FoodEntry[] | null {
    return this._lunch;
  }
  public get dinner(): FoodEntry[] | null {
    return this._dinner;
  }
  public get snacks(): FoodEntry[] | null {
    return this._snacks;
  }
  public get weight(): number | null {
    return this._weight;
  }
}
