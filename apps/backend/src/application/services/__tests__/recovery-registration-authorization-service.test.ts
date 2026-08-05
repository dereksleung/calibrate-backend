import type { IClock } from "@application/ports/clock.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";

import {
  RecoveryRegistrationAuthorizationServiceImpl,
  type IRecoveryRegistrationAuthorizationRepository,
} from "../recovery-registration-authorization-service.js";

const now = new Date("2026-08-04T12:00:00.000Z");

describe("RecoveryRegistrationAuthorizationServiceImpl", () => {
  it("creates a digest-only recovery-registration authorization after explicit confirmation", async () => {
    const repository: IRecoveryRegistrationAuthorizationRepository = {
      authorize: vi.fn().mockResolvedValue(undefined),
    };
    const tokenService: IOpaqueTokenService = {
      create: vi.fn().mockReturnValue({ token: "recovery-registration-token", digest: "token-digest" }),
    };
    const clock: IClock = { now: () => now };
    const service = new RecoveryRegistrationAuthorizationServiceImpl(repository, tokenService, clock);

    await expect(
      service.authorize({ accountAccessToken: "account-access-token", mode: "create" }),
    ).resolves.toEqual({
      recoveryRegistrationToken: "recovery-registration-token",
      expiresAt: new Date("2026-08-04T12:15:00.000Z"),
    });

    expect(repository.authorize).toHaveBeenCalledWith({
      accountAccessTokenDigest: expect.any(String),
      recoveryRegistrationTokenDigest: "token-digest",
      mode: "create",
      clientBinding: "cookie",
      now,
      expiresAt: new Date("2026-08-04T12:15:00.000Z"),
    });
  });
});
