import * as z from "zod";
import { FoodEntryPersistenceDto } from "./food-entry-dtos.js";

// TODO: Consider moving zod schemas to request model file, if it does not DRY anything with the domain model.
// Schema validation will be used at least for create/update request validation.
export const MealNameSchema = z.enum([
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACKS",
]);

export const MealNameEnum = MealNameSchema.enum;

export type MealNameEnumType = z.infer<typeof MealNameSchema>;

export const CommonFoodEntryFieldsSchema = z.object({
  meal: MealNameSchema,
  name: z.string(),
  brand: z.string().nullable(),
  iconName: z.string().nullable(),
  quantity: z.number(),
  quantityUnit: z.string(),
  calories: z.number(),
  totalFatGrams: z.number(),
  saturatedFatGrams: z.number().nullable(),
  cholesterolMg: z.number().nullable(),
  sodiumMg: z.number().nullable(),
  totalCarbohydrateGrams: z.number(),
  fiberGrams: z.number().nullable(),
  sugarGrams: z.number().nullable(),
  proteinGrams: z.number(),
});

export const FoodEntrySchema = z.object({
  ...CommonFoodEntryFieldsSchema.shape,
  id: z.string(),
});

interface FoodEntryProps {
  id: string;
  meal: MealNameEnumType;
  name: string;
  brand: string | null;
  iconName: string | null;
  quantity: number;
  quantityUnit: string;
  calories: number;
  totalFatGrams: number;
  saturatedFatGrams: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  totalCarbohydrateGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  proteinGrams: number;
}

export class FoodEntry {
  private readonly _id: string;
  private readonly _meal: MealNameEnumType;
  private _name: string;
  private _brand: string | null;
  private _iconName: string | null;
  private _quantity: number;
  private _quantityUnit: string;
  private _calories: number;
  private _totalFatGrams: number;
  private _saturatedFatGrams: number | null;
  private _cholesterolMg: number | null;
  private _sodiumMg: number | null;
  private _totalCarbohydrateGrams: number;
  private _fiberGrams: number | null;
  private _sugarGrams: number | null;
  private _proteinGrams: number;

  private constructor({
    id,
    meal,
    name,
    brand,
    iconName,
    quantity,
    quantityUnit,
    calories,
    totalFatGrams,
    saturatedFatGrams,
    cholesterolMg,
    sodiumMg,
    totalCarbohydrateGrams,
    fiberGrams,
    sugarGrams,
    proteinGrams,
  }: FoodEntryProps) {
    this._id = id;
    this._meal = meal;
    this._name = name;
    this._brand = brand;
    this._iconName = iconName;
    this._quantity = quantity;
    this._quantityUnit = quantityUnit;
    this._calories = calories;
    this._totalFatGrams = totalFatGrams;
    this._saturatedFatGrams = saturatedFatGrams;
    this._cholesterolMg = cholesterolMg;
    this._sodiumMg = sodiumMg;
    this._totalCarbohydrateGrams = totalCarbohydrateGrams;
    this._fiberGrams = fiberGrams;
    this._sugarGrams = sugarGrams;
    this._proteinGrams = proteinGrams;
  }

  public static fromPersistence(dto: FoodEntryPersistenceDto): FoodEntry {
    return new FoodEntry({
      id: dto.id,
      meal: dto.meal,
      name: dto.name,
      brand: dto.brand,
      iconName: dto.iconName,
      quantity: dto.quantity,
      quantityUnit: dto.quantityUnit,
      calories: dto.calories,
      totalFatGrams: dto.totalFatGrams,
      saturatedFatGrams: dto.saturatedFatGrams,
      cholesterolMg: dto.cholesterolMg,
      sodiumMg: dto.sodiumMg,
      totalCarbohydrateGrams: dto.totalCarbohydrateGrams,
      fiberGrams: dto.fiberGrams,
      sugarGrams: dto.sugarGrams,
      proteinGrams: dto.proteinGrams,
    });
  }

  public get id(): string {
    return this._id;
  }
  public get meal(): MealNameEnumType {
    return this._meal;
  }
  public get name(): string {
    return this._name;
  }
  public get brand(): string | null {
    return this._brand;
  }
  public get iconName(): string | null {
    return this._iconName;
  }
  public get quantity(): number {
    return this._quantity;
  }
  public get quantityUnit(): string {
    return this._quantityUnit;
  }
  public get calories(): number {
    return this._calories;
  }
  public get totalFatGrams(): number {
    return this._totalFatGrams;
  }
  public get saturatedFatGrams(): number | null {
    return this._saturatedFatGrams;
  }
  public get cholesterolMg(): number | null {
    return this._cholesterolMg;
  }
  public get sodiumMg(): number | null {
    return this._sodiumMg;
  }
  public get totalCarbohydrateGrams(): number {
    return this._totalCarbohydrateGrams;
  }
  public get fiberGrams(): number | null {
    return this._fiberGrams;
  }
  public get sugarGrams(): number | null {
    return this._sugarGrams;
  }
  public get proteinGrams(): number {
    return this._proteinGrams;
  }
}
