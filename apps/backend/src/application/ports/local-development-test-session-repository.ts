import type { User } from "@domain/entities/user.js";

export interface CreateLocalDevelopmentTestSessionInput {
  fixtureUser: User;
  accessTokenDigest: string;
  refreshTokenDigest: string;
  now: Date;
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface CreatedLocalDevelopmentTestSession {
  user: User;
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export interface ILocalDevelopmentTestSessionRepository {
  createOrReuseFixtureSession(
    input: CreateLocalDevelopmentTestSessionInput,
  ): Promise<CreatedLocalDevelopmentTestSession>;
}
