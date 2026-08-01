export interface IAccessSessionRepository {
  findActiveUserIdByTokenDigest(tokenDigest: string, now: Date): Promise<string | null>;
}
