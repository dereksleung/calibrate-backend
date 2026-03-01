import { FoodEntryPersistenceDto } from "./food-entry-dtos.js";

// Repository DTOs
export interface GetDayLogByDateAndUserDto {
  userId: string;
  date: string;
}

export interface DayLogPersistenceDto {
  id: string;
  date: Date;
  weight: number | null;
  breakfast: FoodEntryPersistenceDto[] | null;
  lunch: FoodEntryPersistenceDto[] | null;
  dinner: FoodEntryPersistenceDto[] | null;
  snacks: FoodEntryPersistenceDto[] | null;
}

// Service layer DTOs for client inputs
export interface GetDayLogRequestDto {
  userId: string;
  date: string;
}

// Cross-service DTOs for client inputs, if any
