import type { IRefreshSessionRepository } from "@application/ports/access-session-repository.js";

import type { DatabaseClient } from "../database-client.js";
import { randomUUID } from "node:crypto";

export class PostgresAccessSessionRepository implements IRefreshSessionRepository {
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

  async refresh(input: {
    refreshTokenDigest: string;
    accessTokenDigest: string;
    replacementRefreshTokenDigest: string;
    now: Date;
  }): Promise<{
    userId: string;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  } | null> {
    return this.databaseClient.transaction().execute(async (trx) => {
      const generation = await trx
        .selectFrom("refresh_token_generations as generation")
        .innerJoin("remembered_device_families as family", "family.id", "generation.family_id")
        .select([
          "generation.id", "generation.family_id", "generation.generation", "family.user_id",
          "family.absolute_expires_at", "family.inactivity_expires_at",
        ])
        .where("generation.token_digest", "=", input.refreshTokenDigest)
        .where("generation.consumed_at", "is", null)
        .where("generation.revoked_at", "is", null)
        .where("family.revoked_at", "is", null)
        .where("family.inactivity_expires_at", ">", input.now)
        .where("family.absolute_expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!generation) return null;

      const familyInactivityExpiresAt = new Date(Math.min(
        input.now.getTime() + 7 * 24 * 60 * 60 * 1000,
        generation.absolute_expires_at.getTime(),
      ));
      const accessInactivityExpiresAt = new Date(input.now.getTime() + 30 * 60 * 1000);
      const accessAbsoluteExpiresAt = new Date(Math.min(
        input.now.getTime() + 8 * 60 * 60 * 1000,
        generation.absolute_expires_at.getTime(),
      ));
      const replacementId = randomUUID();
      const sessionId = randomUUID();
      const consumed = await trx.updateTable("refresh_token_generations")
        .set({ consumed_at: input.now, replacement_generation_id: replacementId })
        .where("id", "=", generation.id).where("consumed_at", "is", null).executeTakeFirst();
      if (Number(consumed.numUpdatedRows) !== 1) return null;
      await trx.insertInto("refresh_token_generations").values({
        id: replacementId, family_id: generation.family_id, generation: generation.generation + 1,
        token_digest: input.replacementRefreshTokenDigest, parent_generation_id: generation.id,
        replacement_generation_id: null, created_at: input.now, expires_at: generation.absolute_expires_at,
        consumed_at: null, revoked_at: null,
      }).execute();
      await trx.updateTable("remembered_device_families").set({
        current_refresh_generation: generation.generation + 1, last_used_at: input.now,
        inactivity_expires_at: familyInactivityExpiresAt,
      }).where("id", "=", generation.family_id).execute();
      await trx.updateTable("sessions").set({ replaced_by_session_id: sessionId, renewed_at: input.now })
        .where("remembered_device_family_id", "=", generation.family_id).where("revoked_at", "is", null)
        .where("replaced_by_session_id", "is", null).execute();
      await trx.insertInto("sessions").values({
        id: sessionId, user_id: generation.user_id, token_digest: input.accessTokenDigest, transport: "cookie",
        mobile_platform: null, remembered_device_family_id: generation.family_id, replaced_by_session_id: null,
        created_at: input.now, last_seen_at: input.now, inactivity_expires_at: accessInactivityExpiresAt,
        absolute_expires_at: accessAbsoluteExpiresAt, revoked_at: null, renewed_at: null,
      }).execute();
      return { userId: generation.user_id, accessInactivityExpiresAt, familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: generation.absolute_expires_at };
    });
  }
}
