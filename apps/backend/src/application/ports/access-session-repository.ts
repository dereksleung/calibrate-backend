export interface IAccessSessionRepository {
  findActiveUserIdByTokenDigest(tokenDigest: string, now: Date): Promise<string | null>;
  findSecurityStateByTokenDigest(tokenDigest: string, now: Date): Promise<{
    activeRecovery: null | { restrictionEndsAt: Date };
    sessionRestriction: null | { restrictionEndsAt: Date };
  } | null>;
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
  revokeFamilyForLogout(input: {
    accessTokenDigest?: string;
    refreshTokenDigest?: string;
    now: Date;
  }): Promise<void>;
}
