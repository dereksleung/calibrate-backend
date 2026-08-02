import { PasskeyAuthenticationRateLimitedError } from "@application/errors/passkey-authentication-errors.js";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import type { DatabaseClient } from "../../database-client.js";

import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../../../test/integration/database.js";
import { PostgresPasskeyAuthenticationRepository } from "../postgres-passkey-authentication-repository.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const ipDigestKey = Buffer.alloc(32, 7);

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function optionsInput(
  overrides: Partial<Parameters<PostgresPasskeyAuthenticationRepository["prepareAuthentication"]>[0]> = {},
) {
  const rawChallenge = randomBytes(32).toString("base64url");

  return {
    rawChallenge,
    challengeDigest: digest(rawChallenge),
    requestingIp: "203.0.113.9",
    now,
    maxOptionsRequestsPerIp: 40,
    globalHourlyLimit: 10_000,
    maxVerificationAttempts: 5,
    ...overrides,
  };
}

describe("PostgresPasskeyAuthenticationRepository", () => {
  let databaseClient: DatabaseClient;
  let repository: PostgresPasskeyAuthenticationRepository;

  beforeAll(() => {
    databaseClient = createIntegrationDatabaseClient();
    repository = new PostgresPasskeyAuthenticationRepository({ ipDigestKey }, databaseClient);
  });

  beforeEach(async () => {
    await clearIntegrationDatabase(databaseClient);
  });

  afterAll(async () => {
    await databaseClient.destroy();
  });

  it("creates a login challenge without enrollment state and persists only digests", async () => {
    const input = optionsInput();

    const prepared = await repository.prepareAuthentication(input);

    expect(prepared.rawChallenge).toBe(input.rawChallenge);
    expect(prepared.challengeExpiresAt).toEqual(new Date(now.getTime() + 5 * 60_000));

    const challenge = await databaseClient
      .selectFrom("webauthn_challenges")
      .selectAll()
      .where("id", "=", prepared.challengeId)
      .executeTakeFirstOrThrow();
    const rateLimitEvent = await databaseClient
      .selectFrom("passkey_authentication_rate_limit_events")
      .selectAll()
      .executeTakeFirstOrThrow();

    expect(challenge).toMatchObject({
      enrollment_authorization_id: null,
      purpose: "passkey-login",
      challenge_digest: input.challengeDigest,
      attempt_count: 0,
      max_attempts: 5,
      expires_at: new Date(now.getTime() + 5 * 60_000),
    });
    expect(challenge.challenge_digest).not.toBe(input.rawChallenge);
    expect(rateLimitEvent).toMatchObject({
      scope: "passkey-authentication-options",
      requesting_ip_digest: createHmac("sha256", ipDigestKey).update(input.requestingIp).digest("base64url"),
      created_at: now,
    });
    expect(rateLimitEvent.requesting_ip_digest).not.toBe(input.requestingIp);
  });

  it("enforces the options IP limit and reports when its rolling window reopens", async () => {
    for (let count = 0; count < 40; count += 1) {
      await repository.prepareAuthentication(optionsInput());
    }

    await expect(repository.prepareAuthentication(optionsInput())).rejects.toEqual(
      new PasskeyAuthenticationRateLimitedError(3600),
    );

    await expect(
      repository.prepareAuthentication(optionsInput({ now: new Date(now.getTime() + 60 * 60_000) })),
    ).resolves.toMatchObject({ challengeExpiresAt: new Date(now.getTime() + 65 * 60_000) });
  });

  it("does not share an options bucket between IP digests", async () => {
    await repository.prepareAuthentication(optionsInput({ maxOptionsRequestsPerIp: 1 }));

    await expect(
      repository.prepareAuthentication(
        optionsInput({ maxOptionsRequestsPerIp: 1, requestingIp: "203.0.113.10" }),
      ),
    ).resolves.toMatchObject({ challengeExpiresAt: new Date(now.getTime() + 5 * 60_000) });
  });

  it("keeps verification limiting independent from options limiting", async () => {
    await repository.prepareAuthentication(optionsInput({ maxOptionsRequestsPerIp: 1 }));

    await expect(
      repository.consumeVerificationRateLimit({
        requestingIp: "203.0.113.9",
        now,
        maxVerificationRequestsPerIp: 1,
        globalHourlyLimit: 10_000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.consumeVerificationRateLimit({
        requestingIp: "203.0.113.9",
        now,
        maxVerificationRequestsPerIp: 1,
        globalHourlyLimit: 10_000,
      }),
    ).rejects.toEqual(new PasskeyAuthenticationRateLimitedError(3600));
  });

  it("rolls back the rate-limit event when challenge insertion fails", async () => {
    const input = optionsInput();
    await repository.prepareAuthentication(input);

    await expect(
      repository.prepareAuthentication(optionsInput({ challengeDigest: input.challengeDigest })),
    ).rejects.toMatchObject({ code: "23505" });

    const events = await databaseClient
      .selectFrom("passkey_authentication_rate_limit_events")
      .select("id")
      .execute();
    expect(events).toHaveLength(1);
  });

  it("serializes the configurable global options ceiling across repository instances", async () => {
    const otherRepository = new PostgresPasskeyAuthenticationRepository({ ipDigestKey }, databaseClient);

    const results = await Promise.allSettled([
      repository.prepareAuthentication(optionsInput({ globalHourlyLimit: 1 })),
      otherRepository.prepareAuthentication(
        optionsInput({ globalHourlyLimit: 1, requestingIp: "203.0.113.10" }),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: new PasskeyAuthenticationRateLimitedError(3600),
    });
  });

  it("removes expired rate-limit events without changing active-window enforcement", async () => {
    await databaseClient
      .insertInto("passkey_authentication_rate_limit_events")
      .values({
        id: randomUUID(),
        scope: "passkey-authentication-options",
        requesting_ip_digest: "expired-digest",
        created_at: new Date(now.getTime() - 24 * 60 * 60_000 - 1),
      })
      .execute();

    await repository.prepareAuthentication(optionsInput());

    await expect(
      databaseClient
        .selectFrom("passkey_authentication_rate_limit_events")
        .select("id")
        .where("requesting_ip_digest", "=", "expired-digest")
        .executeTakeFirst(),
    ).resolves.toBeUndefined();
  });
});
