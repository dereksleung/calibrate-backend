import { describe, expect, it, vi } from "vitest";

import { requestLocalDevelopmentPasskeyEnrollment } from "./local-development-passkey-enrollment.js";

describe("requestLocalDevelopmentPasskeyEnrollment", () => {
  it("requests a cookie-backed local enrollment handoff", async () => {
    const transport = {
      request: vi.fn().mockResolvedValue({
        email: "local-123@example.test",
        next: "passkey-registration",
        expiresAt: "2030-01-01T00:05:00.000Z",
      }),
    };

    await expect(requestLocalDevelopmentPasskeyEnrollment(transport)).resolves.toEqual({
      email: "local-123@example.test",
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    expect(transport.request).toHaveBeenCalledWith({
      path: "/auth/local-development/passkey-enrollment",
      method: "POST",
      responseBodySchema: expect.anything(),
    });
  });
});
