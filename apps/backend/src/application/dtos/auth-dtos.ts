import { User } from "@domain/entities/user.js";

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResultDto {
  accessToken: string;
  expiresInSeconds: number;
  user: User;
}
