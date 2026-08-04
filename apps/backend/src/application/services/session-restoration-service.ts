import type { IClock } from "@application/ports/clock.js";
import type { IRefreshSessionRepository } from "@application/ports/access-session-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { IUserRepository } from "@application/ports/user-repository.js";
import type { User } from "@domain/entities/user.js";
import { createHash } from "node:crypto";

export interface ISessionRestorationService {
  getCurrentSession(accessToken: string): Promise<User | null>;
  logout(credentials: { accessToken?: string; refreshToken?: string }): Promise<void>;
  refresh(refreshToken: string): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  } | null>;
}

export class SessionRestorationServiceImpl implements ISessionRestorationService {
  constructor(
    private readonly sessions: IRefreshSessionRepository,
    private readonly tokens: IOpaqueTokenService,
    private readonly users: IUserRepository,
    private readonly clock: IClock,
  ) {}

  async getCurrentSession(accessToken: string): Promise<User | null> {
    const userId = await this.sessions.findActiveUserIdByTokenDigest(digest(accessToken), this.clock.now());
    return userId ? this.users.findById(userId) : null;
  }

  async logout(credentials: { accessToken?: string; refreshToken?: string }): Promise<void> {
    await this.sessions.revokeFamilyForLogout({
      accessTokenDigest: credentials.accessToken ? digest(credentials.accessToken) : undefined,
      refreshTokenDigest: credentials.refreshToken ? digest(credentials.refreshToken) : undefined,
      now: this.clock.now(),
    });
  }

  async refresh(refreshToken: string) {
    const access = this.tokens.create();
    const refresh = this.tokens.create();
    const result = await this.sessions.refresh({
      refreshTokenDigest: digest(refreshToken),
      accessTokenDigest: access.digest,
      replacementRefreshTokenDigest: refresh.digest,
      now: this.clock.now(),
    });
    if (!result) return null;
    const user = await this.users.findById(result.userId);
    if (!user) return null;
    return { user, accessToken: access.token, refreshToken: refresh.token, ...result };
  }
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
