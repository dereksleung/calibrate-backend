import { User } from "@domain/entities/user.js";
import { createHash, randomUUID } from "node:crypto";

import type { DatabaseClient } from "../../database-client.js";

import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../../../test/integration/database.js";
import { PostgresLocalDevelopmentTestSessionRepository } from "../postgres-local-development-test-session-repository.js";

const firstNow = new Date("2026-08-16T12:00:00.000Z");
const secondNow = new Date("2026-08-16T12:01:00.000Z");

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function createInput(
  overrides: Partial<{
    accessTokenDigest: string;
    refreshTokenDigest: string;
    now: Date;
    user: User;
  }> = {},
) {
  const now = overrides.now ?? firstNow;
  return {
    fixtureUser:
      overrides.user ??
      User.createForLocalDevelopmentFixture({
        email: "local-test-session@example.test",
        createdAt: now,
        updatedAt: now,
      }),
    accessTokenDigest: overrides.accessTokenDigest ?? `access-digest-${randomUUID()}`,
    refreshTokenDigest: overrides.refreshTokenDigest ?? `refresh-digest-${randomUUID()}`,
    now,
    accessInactivityExpiresAt: new Date(now.getTime() + 30 * 60_000),
    accessAbsoluteExpiresAt: new Date(now.getTime() + 8 * 60 * 60_000),
    familyInactivityExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
    familyAbsoluteExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
  };
}

describe("PostgresLocalDevelopmentTestSessionRepository", () => {
  let databaseClient: DatabaseClient;
  let repository: PostgresLocalDevelopmentTestSessionRepository;

  beforeAll(() => {
    databaseClient = createIntegrationDatabaseClient();
    repository = new PostgresLocalDevelopmentTestSessionRepository(databaseClient);
  });

  beforeEach(async () => clearIntegrationDatabase(databaseClient));
  afterAll(async () => databaseClient.destroy());

  it("atomically creates the reserved identity and a cookie-backed session generation without passkey state", async () => {
    const rawAccessToken = "raw-access-token";
    const rawRefreshToken = "raw-refresh-token";
    const input = createInput({
      accessTokenDigest: digest(rawAccessToken),
      refreshTokenDigest: digest(rawRefreshToken),
    });

    const result = await repository.createOrReuseFixtureSession(input);

    expect(result.user.id).toBe(input.fixtureUser.id);
    expect(result.user.email).toBe("local-test-session@example.test");

    const users = await databaseClient.selectFrom("users").selectAll().execute();
    const families = await databaseClient.selectFrom("remembered_device_families").selectAll().execute();
    const generations = await databaseClient.selectFrom("refresh_token_generations").selectAll().execute();
    const sessions = await databaseClient.selectFrom("sessions").selectAll().execute();
    const passkeys = await databaseClient.selectFrom("passkey_credentials").selectAll().execute();
    const events = await databaseClient.selectFrom("security_events").selectAll().execute();

    expect(users).toHaveLength(1);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      recent_passkey_authentication_at: null,
      recent_passkey_authentication_purpose: null,
      authentication_method: "local-development",
      current_refresh_generation: 0,
    });
    expect(generations).toHaveLength(1);
    expect(generations[0]).toMatchObject({
      family_id: families[0]?.id,
      generation: 0,
      token_digest: digest(rawRefreshToken),
      consumed_at: null,
      revoked_at: null,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      user_id: input.fixtureUser.id,
      token_digest: digest(rawAccessToken),
      transport: "cookie",
      mobile_platform: null,
      remembered_device_family_id: families[0]?.id,
    });
    expect(passkeys).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("local-development-session-created");
    expect(JSON.stringify({ users, generations, sessions })).not.toContain(rawAccessToken);
    expect(JSON.stringify({ users, generations, sessions })).not.toContain(rawRefreshToken);
  });

  it("reuses the reserved identity while creating a fresh family, generation, and access session", async () => {
    const firstInput = createInput({
      accessTokenDigest: "access-digest-one",
      refreshTokenDigest: "refresh-digest-one",
    });
    const first = await repository.createOrReuseFixtureSession(firstInput);
    const secondInput = createInput({
      accessTokenDigest: "access-digest-two",
      refreshTokenDigest: "refresh-digest-two",
      now: secondNow,
      user: User.createForLocalDevelopmentFixture({
        email: "local-test-session@example.test",
        createdAt: secondNow,
        updatedAt: secondNow,
      }),
    });

    const second = await repository.createOrReuseFixtureSession(secondInput);

    expect(second.user.id).toBe(first.user.id);
    expect(await databaseClient.selectFrom("users").selectAll().execute()).toHaveLength(1);
    expect(await databaseClient.selectFrom("remembered_device_families").selectAll().execute()).toHaveLength(
      2,
    );
    expect(await databaseClient.selectFrom("refresh_token_generations").selectAll().execute()).toHaveLength(
      2,
    );
    expect(await databaseClient.selectFrom("sessions").selectAll().execute()).toHaveLength(2);
  });

  it("fails closed when the reserved email belongs to a password user", async () => {
    await databaseClient
      .insertInto("users")
      .values({
        id: randomUUID(),
        email: "local-test-session@example.test",
        password_hash: "existing-password-hash",
        email_verified_at: null,
        webauthn_user_handle: null,
        tier: "FREE",
        created_at: firstNow.toISOString(),
        updated_at: firstNow.toISOString(),
      })
      .execute();

    await expect(repository.createOrReuseFixtureSession(createInput())).rejects.toThrow();

    expect(await databaseClient.selectFrom("users").selectAll().execute()).toHaveLength(1);
    expect(await databaseClient.selectFrom("remembered_device_families").selectAll().execute()).toHaveLength(
      0,
    );
    expect(await databaseClient.selectFrom("refresh_token_generations").selectAll().execute()).toHaveLength(
      0,
    );
    expect(await databaseClient.selectFrom("sessions").selectAll().execute()).toHaveLength(0);
    expect(await databaseClient.selectFrom("security_events").selectAll().execute()).toHaveLength(0);
  });

  it("fails closed when the reserved identity still has passkey credentials", async () => {
    const userId = randomUUID();
    await databaseClient
      .insertInto("users")
      .values({
        id: userId,
        email: "local-test-session@example.test",
        password_hash: null,
        email_verified_at: null,
        webauthn_user_handle: null,
        tier: "FREE",
        created_at: firstNow.toISOString(),
        updated_at: firstNow.toISOString(),
      })
      .execute();
    await databaseClient
      .insertInto("passkey_credentials")
      .values({
        id: randomUUID(),
        user_id: userId,
        credential_id: "stale-credential-id",
        public_key: Buffer.from([1]),
        algorithm: -7,
        transports: ["internal"],
        signature_counter: BigInt(0),
        aaguid: "00000000-0000-0000-0000-000000000000",
        backup_eligible: false,
        backup_state: false,
        created_at: firstNow,
        last_used_at: null,
        revoked_at: null,
      })
      .execute();

    await expect(repository.createOrReuseFixtureSession(createInput())).rejects.toThrow();

    expect(await databaseClient.selectFrom("remembered_device_families").selectAll().execute()).toHaveLength(
      0,
    );
    expect(await databaseClient.selectFrom("refresh_token_generations").selectAll().execute()).toHaveLength(
      0,
    );
    expect(await databaseClient.selectFrom("sessions").selectAll().execute()).toHaveLength(0);
    expect(await databaseClient.selectFrom("security_events").selectAll().execute()).toHaveLength(0);
  });

  it("rolls back the new family and session when generation persistence fails", async () => {
    const firstInput = createInput({
      accessTokenDigest: "duplicate-access-digest",
      refreshTokenDigest: "refresh-digest-one",
    });
    await repository.createOrReuseFixtureSession(firstInput);

    await expect(
      repository.createOrReuseFixtureSession(
        createInput({
          accessTokenDigest: "duplicate-access-digest",
          refreshTokenDigest: "refresh-digest-two",
          now: secondNow,
        }),
      ),
    ).rejects.toThrow();

    expect(await databaseClient.selectFrom("users").selectAll().execute()).toHaveLength(1);
    expect(await databaseClient.selectFrom("remembered_device_families").selectAll().execute()).toHaveLength(
      1,
    );
    expect(await databaseClient.selectFrom("refresh_token_generations").selectAll().execute()).toHaveLength(
      1,
    );
    expect(await databaseClient.selectFrom("sessions").selectAll().execute()).toHaveLength(1);
  });
});
