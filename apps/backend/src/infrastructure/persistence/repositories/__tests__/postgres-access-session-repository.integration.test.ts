import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../../database-client.js";
import type { InsertableUser } from "../../schemas/users-table.js";
import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../../../test/integration/database.js";
import { PostgresAccessSessionRepository } from "../postgres-access-session-repository.js";

const now = new Date("2026-08-03T12:00:00.000Z");

async function createActiveFamily(databaseClient: DatabaseClient) {
  const userInput: InsertableUser & { id: string } = {
    id: randomUUID(),
    email: "person@example.com",
    password_hash: null,
    email_verified_at: now,
    webauthn_user_handle: "user-handle",
    tier: "FREE",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const user = await databaseClient
    .insertInto("users")
    .values(userInput)
    .returning("id")
    .executeTakeFirstOrThrow();
  const familyId = randomUUID();
  await databaseClient.insertInto("remembered_device_families").values({
    id: familyId,
    user_id: user.id,
    created_at: now,
    last_used_at: now,
    inactivity_expires_at: new Date("2026-08-10T12:00:00.000Z"),
    absolute_expires_at: new Date("2026-09-02T12:00:00.000Z"),
    recent_passkey_authentication_at: null,
    recent_passkey_authentication_purpose: null,
    authentication_method: "passkey",
    current_refresh_generation: 1,
    revoked_at: null,
    revocation_reason: null,
  }).execute();
  return { familyId, userId: user.id };
}

describe("PostgresAccessSessionRepository.revokeFamilyForLogout", () => {
  let databaseClient: DatabaseClient;
  let repository: PostgresAccessSessionRepository;

  beforeAll(() => {
    databaseClient = createIntegrationDatabaseClient();
    repository = new PostgresAccessSessionRepository(databaseClient);
  });

  beforeEach(async () => clearIntegrationDatabase(databaseClient));
  afterAll(async () => databaseClient.destroy());

  it("atomically revokes the family and every active access session identified by a valid access digest", async () => {
    const { familyId, userId } = await createActiveFamily(databaseClient);
    const activeSessionIds = [randomUUID(), randomUUID()];
    await databaseClient.insertInto("sessions").values(activeSessionIds.map((id, index) => ({
      id,
      user_id: userId,
      token_digest: index === 0 ? "access-digest" : "other-access-digest",
      transport: "cookie",
      mobile_platform: null,
      remembered_device_family_id: familyId,
      replaced_by_session_id: null,
      created_at: now,
      last_seen_at: now,
      inactivity_expires_at: new Date("2026-08-03T12:30:00.000Z"),
      absolute_expires_at: new Date("2026-08-03T20:00:00.000Z"),
      revoked_at: null,
      renewed_at: null,
    }))).execute();

    await repository.revokeFamilyForLogout({ accessTokenDigest: "access-digest", now });

    const family = await databaseClient.selectFrom("remembered_device_families").selectAll().where("id", "=", familyId).executeTakeFirstOrThrow();
    const sessions = await databaseClient.selectFrom("sessions").selectAll().where("remembered_device_family_id", "=", familyId).execute();
    expect(family.revoked_at).toEqual(now);
    expect(family.revocation_reason).toBe("current-device-logout");
    expect(sessions.every((session) => session.revoked_at?.getTime() === now.getTime())).toBe(true);
  });

  it("does not mutate state when neither credential is recognized", async () => {
    const { familyId } = await createActiveFamily(databaseClient);

    await repository.revokeFamilyForLogout({ accessTokenDigest: "unknown", refreshTokenDigest: "unknown", now });

    const family = await databaseClient.selectFrom("remembered_device_families").select("revoked_at").where("id", "=", familyId).executeTakeFirstOrThrow();
    expect(family.revoked_at).toBeNull();
  });
});
