export interface FoodCatalogInput {
  name: string;
  brand: string | null;
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
  source: string;
  sourceFoodId: string;
  normalizedGtin: string | null;
  verificationState: "verified";
}

export interface FoodCatalogRecord extends FoodCatalogInput {
  id: string;
  popularity: number;
}

export interface IFoodCatalogWriter {
  upsert(input: FoodCatalogInput): Promise<FoodCatalogRecord>;
}
