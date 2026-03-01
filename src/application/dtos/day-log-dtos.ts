// Repository DTOs
export interface GetDayLogByDateAndUserDto {
  userId: string;
  date: string;
}
// Service layer DTOs for client inputs
export interface GetDayLogRequestDto {
  userId: string;
  date: string;
}

// Cross-service DTOs for client inputs, if any
