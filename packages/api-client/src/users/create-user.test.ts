import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";
import { createUser } from "./create-user.js";

describe("createUser", () => {
  it("posts validated credentials and parses the created user", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => {
      return responseBodySchema.parse({
        id: "37c45296-c318-45c2-818f-68c37bb06dce",
        email: "sam@example.com",
        tier: "FREE",
        createdAt: "2026-07-11T12:00:00.000Z",
        updatedAt: "2026-07-11T12:00:00.000Z",
      });
    });
    const transport = { request } as unknown as ApiTransport;

    const result = await createUser(transport, {
      email: "sam@example.com",
      password: "Strong1!",
    });

    expect(request).toHaveBeenCalledWith({
      path: "/users",
      method: "POST",
      body: {
        email: "sam@example.com",
        password: "Strong1!",
      },
      responseBodySchema: expect.any(Object),
    });
    expect(result.email).toBe("sam@example.com");
    expect(result.createdAt).toEqual(new Date("2026-07-11T12:00:00.000Z"));
  });
});
