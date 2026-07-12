import {
  CreateUserRequestBodySchema,
  UserResponseSchema,
  type CreateUserRequestBody,
  type UserResponse,
} from "@calibrate/api-contracts";

import type { ApiTransport } from "../transport.js";

/** Creates a user through the app-owned transport using the shared request and response contracts. */
export function createUser(
  transport: ApiTransport,
  input: CreateUserRequestBody,
): Promise<UserResponse> {
  const body = CreateUserRequestBodySchema.parse(input);

  return transport.request({
    path: "/users",
    method: "POST",
    body,
    responseBodySchema: UserResponseSchema,
  });
}
