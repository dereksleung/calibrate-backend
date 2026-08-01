import type { IAccessSessionRepository } from "@application/ports/access-session-repository.js";

import type { DatabaseClient } from "../database-client.js";

export class PostgresAccessSessionRepository implements IAccessSessionRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findActiveUserIdByTokenDigest(tokenDigest: string, now: Date): Promise<string | null> {
    const session = await this.databaseClient
      .selectFrom("sessions")
      .leftJoin(
        "remembered_device_families",
        "remembered_device_families.id",
        "sessions.remembered_device_family_id",
      )
      .select(["sessions.user_id"])
      .where("sessions.token_digest", "=", tokenDigest)
      .where("sessions.inactivity_expires_at", ">", now)
      .where("sessions.absolute_expires_at", ">", now)
      .where("sessions.revoked_at", "is", null)
      .where("sessions.replaced_by_session_id", "is", null)
      .where((eb) =>
        eb.or([
          eb("sessions.remembered_device_family_id", "is", null),
          eb.and([
            eb("remembered_device_families.revoked_at", "is", null),
            eb("remembered_device_families.inactivity_expires_at", ">", now),
            eb("remembered_device_families.absolute_expires_at", ">", now),
          ]),
        ]),
      )
      .executeTakeFirst();

    return session?.user_id ?? null;
  }
}
