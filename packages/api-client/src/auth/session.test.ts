import { describe, expect, it, vi } from "vitest";

import type { ApiTransport } from "../transport.js";
import {
  deleteCurrentSession,
  getCurrentSession,
  refreshSession,
  startLocalDevelopmentTestSession,
} from "./session.js";

const session = {
  user: { id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff", email: "person@example.com", tier: "FREE", createdAt: "2030-01-01T00:00:00.000Z", updatedAt: "2030-01-01T00:00:00.000Z" },
  sessionTransport: "cookie" as const,
};

describe("session restoration API client", () => {
  it("gets the current access session", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse(session));
    await expect(getCurrentSession({ request } as unknown as ApiTransport)).resolves.toMatchObject({
      user: { email: "person@example.com" },
      sessionTransport: "cookie",
    });
    expect(request).toHaveBeenCalledWith({ path: "/auth/session", responseBodySchema: expect.any(Object) });
  });

  it("posts without a body to refresh the session", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse(session));
    await expect(refreshSession({ request } as unknown as ApiTransport)).resolves.toMatchObject({
      user: { email: "person@example.com" },
      sessionTransport: "cookie",
    });
    expect(request).toHaveBeenCalledWith({ path: "/auth/session/refresh", method: "POST", responseBodySchema: expect.any(Object) });
  });

  it("starts a local test session through the cookie-backed auth route", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse(session));

    await expect(
      startLocalDevelopmentTestSession({ request } as unknown as ApiTransport),
    ).resolves.toMatchObject({
      user: { email: "person@example.com" },
      sessionTransport: "cookie",
    });
    expect(request).toHaveBeenCalledWith({
      path: "/auth/local-development/test-session",
      method: "POST",
      responseBodySchema: expect.any(Object),
    });
  });

  it("deletes the current session without a request body and accepts a 204 response", async () => {
    const request = vi.fn(async ({ responseBodySchema }) => responseBodySchema.parse(null));

    await expect(deleteCurrentSession({ request } as unknown as ApiTransport)).resolves.toBeNull();

    expect(request).toHaveBeenCalledWith({
      path: "/auth/session",
      method: "DELETE",
      responseBodySchema: expect.any(Object),
    });
  });
});
