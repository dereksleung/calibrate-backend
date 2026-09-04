import { BusinessLogicError } from "../errors/business-logic-error.js";

export const MIN_DAY_LOG_VERSION_NUMBER = 1;
export const MAX_DAY_LOG_VERSION_NUMBER = 2_147_483_647;

export class DayLogVersionNumber {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  public static from(value: number): DayLogVersionNumber {
    if (
      !Number.isInteger(value) ||
      value < MIN_DAY_LOG_VERSION_NUMBER ||
      value > MAX_DAY_LOG_VERSION_NUMBER
    ) {
      throw new BusinessLogicError("Day Log versionNumber must be a positive int32");
    }

    return new DayLogVersionNumber(value);
  }

  public get value(): number {
    return this._value;
  }
}
