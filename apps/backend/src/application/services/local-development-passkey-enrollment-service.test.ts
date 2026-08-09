import type { IClock } from "@application/ports/clock.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { ISignupEnrollmentAuthorizationRepository } from "@application/ports/signup-enrollment-authorization-repository.js";
import { describe, expect, it, vi } from "vitest";

import { LocalDevelopmentPasskeyEnrollmentService } from "./local-development-passkey-enrollment-service.js";

describe("LocalDevelopmentPasskeyEnrollmentService", () => {
  it("creates a short-lived cookie enrollment with a reserved local email", async () => {
    const repository: ISignupEnrollmentAuthorizationRepository = {
      createLocalDevelopmentAuthorization: vi.fn(),
      consumeAndResolveContinuation: vi.fn(),
    };
    const tokenService: IOpaqueTokenService = {
      create: vi.fn(() => ({ token: "raw-token", digest: "token-digest" })),
    };
    const clock: IClock = { now: () => new Date("2026-08-09T12:00:00.000Z") };
    const service = new LocalDevelopmentPasskeyEnrollmentService(repository, tokenService, clock);

    const result = await service.create();

    expect(result).toEqual({
      token: "raw-token",
      email: expect.stringMatching(/^local-[0-9a-f-]+@example\.test$/),
      expiresAt: new Date("2026-08-09T12:05:00.000Z"),
    });
    expect(repository.createLocalDevelopmentAuthorization).toHaveBeenCalledWith({
      authorization: expect.objectContaining({
        email: result.email,
        tokenDigest: "token-digest",
        sessionTransport: "cookie",
        mobilePlatform: null,
        createdAt: new Date("2026-08-09T12:00:00.000Z"),
        expiresAt: new Date("2026-08-09T12:05:00.000Z"),
      }),
    });
  });
});
