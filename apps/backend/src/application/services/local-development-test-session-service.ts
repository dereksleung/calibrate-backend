import type { IClock } from "@application/ports/clock.js";
import type { ILocalDevelopmentTestSessionRepository } from "@application/ports/local-development-test-session-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";

import { User } from "@domain/entities/user.js";

import { calculateSessionLifetimes } from "./session-lifetime-calculator.js";

export const LOCAL_TEST_FIXTURE_EMAIL = "local-test-session@example.test";

export interface LocalDevelopmentTestSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  rememberDevice: true;
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface ILocalDevelopmentTestSessionService {
  create(): Promise<LocalDevelopmentTestSession>;
}

/**
 * Creates a normal cookie-backed session for one reserved local fixture user.
 * This intentionally does not create a passkey or record passkey re-authentication.
 */
export class LocalDevelopmentTestSessionService implements ILocalDevelopmentTestSessionService {
  constructor(
    private readonly repository: ILocalDevelopmentTestSessionRepository,
    private readonly tokenService: IOpaqueTokenService,
    private readonly clock: IClock,
  ) {}

  async create(): Promise<LocalDevelopmentTestSession> {
    const now = this.clock.now();
    const accessToken = this.tokenService.create();
    const refreshToken = this.tokenService.create();
    const lifetimes = calculateSessionLifetimes(now);
    const fixtureUser = User.createForLocalDevelopmentFixture({
      email: LOCAL_TEST_FIXTURE_EMAIL,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.repository.createOrReuseFixtureSession({
      fixtureUser,
      accessTokenDigest: accessToken.digest,
      refreshTokenDigest: refreshToken.digest,
      now,
      ...lifetimes,
    });

    return {
      user: persisted.user,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      rememberDevice: true,
      accessInactivityExpiresAt: persisted.accessInactivityExpiresAt,
      accessAbsoluteExpiresAt: persisted.accessAbsoluteExpiresAt,
      familyInactivityExpiresAt: persisted.familyInactivityExpiresAt,
      familyAbsoluteExpiresAt: persisted.familyAbsoluteExpiresAt,
    };
  }
}

export class UnavailableLocalDevelopmentTestSessionService implements ILocalDevelopmentTestSessionService {
  create(): Promise<LocalDevelopmentTestSession> {
    return Promise.reject(new Error("Local development test session unavailable"));
  }
}
