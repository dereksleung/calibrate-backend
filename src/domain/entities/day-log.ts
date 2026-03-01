import { FoodEntry } from "./food-entry.js";

/**
 * The day log will be an aggregate root. It will be the public interface
 * for child entities, and will need those entities' info
 * to be strongly consistent for business rules to work correctly, and
 * not lead to an invalid system state.
 */

interface DayLogProps {
  id: string;
  date: Date;
  breakfast: FoodEntry[] | null;
  lunch: FoodEntry[] | null;
  dinner: FoodEntry[] | null;
  snacks: FoodEntry[] | null;
  weight: number | null;
}

export class DayLog {
  private readonly _id: string;
  private readonly _date: Date;
  private _breakfast: FoodEntry[] | null;
  private _lunch: FoodEntry[] | null;
  private _dinner: FoodEntry[] | null;
  private _snacks: FoodEntry[] | null;
  private _weight: number | null;

  private constructor({
    id,
    date,
    breakfast,
    lunch,
    dinner,
    snacks,
    weight,
  }: DayLogProps) {
    this._id = id;
    this._date = date;
    this._breakfast = breakfast ?? null;
    this._lunch = lunch ?? null;
    this._dinner = dinner ?? null;
    this._snacks = snacks ?? null;
    this._weight = weight ?? null;
  }

  public static reconstitute(props: DayLogProps): DayLog {
    return new DayLog(props);
  }

  public get id(): string {
    return this._id;
  }
  public get date(): Date {
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
