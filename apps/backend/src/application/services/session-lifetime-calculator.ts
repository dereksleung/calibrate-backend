const ACCESS_INACTIVITY_MS = 30 * 60 * 1000;
const ACCESS_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const FAMILY_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const FAMILY_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionLifetimes {
  accessInactivityExpiresAt: Date;
  accessAbsoluteExpiresAt: Date;
  familyInactivityExpiresAt: Date;
  familyAbsoluteExpiresAt: Date;
}

export function calculateSessionLifetimes(now: Date): SessionLifetimes {
  const familyAbsoluteExpiresAt = new Date(now.getTime() + FAMILY_ABSOLUTE_MS);
  return {
    accessInactivityExpiresAt: new Date(now.getTime() + ACCESS_INACTIVITY_MS),
    accessAbsoluteExpiresAt: new Date(
      Math.min(now.getTime() + ACCESS_ABSOLUTE_MS, familyAbsoluteExpiresAt.getTime()),
    ),
    familyInactivityExpiresAt: new Date(now.getTime() + FAMILY_INACTIVITY_MS),
    familyAbsoluteExpiresAt,
  };
}
