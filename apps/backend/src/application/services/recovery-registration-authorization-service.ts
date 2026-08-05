import type { IClock } from "@application/ports/clock.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";

import { createHash } from "node:crypto";

const AUTHORIZATION_LIFETIME_MS = 15 * 60_000;

export type RecoveryRegistrationMode = "create" | "replace-provisional";

export interface IRecoveryRegistrationAuthorizationRepository {
  authorize(input: {
    accountAccessTokenDigest: string;
    recoveryRegistrationTokenDigest: string;
    mode: RecoveryRegistrationMode;
    clientBinding: "cookie";
    now: Date;
    expiresAt: Date;
  }): Promise<void>;
  getAccountAccessStatus(input: { accountAccessTokenDigest: string; now: Date }): Promise<{
    email: string;
    hasRegisteredPasskeys: boolean;
    activeRecovery: null | { restrictionEndsAt: Date };
    authorizationExpiresAt: Date;
  } | null>;
}

export interface IRecoveryRegistrationAuthorizationService {
  authorize(input: {
    accountAccessToken: string;
    mode: RecoveryRegistrationMode;
  }): Promise<{ recoveryRegistrationToken: string; expiresAt: Date }>;
  getAccountAccessStatus(accountAccessToken: string): Promise<{
    email: string;
    hasRegisteredPasskeys: boolean;
    activeRecovery: { state: "none" } | { state: "provisional" | "promotion-eligible"; restrictionEndsAt: string };
    authorizationExpiresAt: string;
  } | null>;
}

export class RecoveryRegistrationAuthorizationServiceImpl
  implements IRecoveryRegistrationAuthorizationService
{
  constructor(
    private readonly repository: IRecoveryRegistrationAuthorizationRepository,
    private readonly tokenService: IOpaqueTokenService,
    private readonly clock: IClock,
  ) {}

  async authorize(input: {
    accountAccessToken: string;
    mode: RecoveryRegistrationMode;
  }): Promise<{ recoveryRegistrationToken: string; expiresAt: Date }> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + AUTHORIZATION_LIFETIME_MS);
    const authorization = this.tokenService.create();
    await this.repository.authorize({
      accountAccessTokenDigest: createHash("sha256").update(input.accountAccessToken).digest("base64url"),
      recoveryRegistrationTokenDigest: authorization.digest,
      mode: input.mode,
      clientBinding: "cookie",
      now,
      expiresAt,
    });
    return { recoveryRegistrationToken: authorization.token, expiresAt };
  }

  async getAccountAccessStatus(accountAccessToken: string): Promise<{
    email: string;
    hasRegisteredPasskeys: boolean;
    activeRecovery: { state: "none" } | { state: "provisional" | "promotion-eligible"; restrictionEndsAt: string };
    authorizationExpiresAt: string;
  } | null> {
    const now = this.clock.now();
    const status = await this.repository.getAccountAccessStatus({
      accountAccessTokenDigest: createHash("sha256").update(accountAccessToken).digest("base64url"),
      now,
    });
    if (!status) return null;
    return {
      email: status.email,
      hasRegisteredPasskeys: status.hasRegisteredPasskeys,
      activeRecovery: status.activeRecovery
        ? {
            state: status.activeRecovery.restrictionEndsAt.getTime() <= now.getTime() ? "promotion-eligible" : "provisional",
            restrictionEndsAt: status.activeRecovery.restrictionEndsAt.toISOString(),
          }
        : { state: "none" as const },
      authorizationExpiresAt: status.authorizationExpiresAt.toISOString(),
    };
  }
}
