export interface IAccessSessionRepository {
  findActiveUserIdByTokenDigest(tokenDigest: string, now: Date): Promise<string | null>;
}

export interface IRefreshSessionRepository extends IAccessSessionRepository {
  refresh(input: {
    refreshTokenDigest: string;
    accessTokenDigest: string;
    replacementRefreshTokenDigest: string;
    now: Date;
  }): Promise<{
    userId: string;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  } | null>;
}
