import type { Insertable, Kysely } from "kysely";

import { RateLimitError, type NewEmailOtpChallenge } from "@application";
import { createHmac, randomUUID } from "node:crypto";

import type { Database } from "../../database.js";

import {
  clearIntegrationDatabase,
  createIntegrationDatabase,
} from "../../../../../test/integration/database.js";
import { PostgresEmailOtpChallengeRepository } from "../postgres-email-otp-challenge-repository.js";

const createdAt = new Date("2026-07-29T12:00:00.000Z");
const ipDigestKey = Buffer.alloc(32, 9);

function challenge(overrides: Partial<NewEmailOtpChallenge> = {}): NewEmailOtpChallenge {
  return {
    id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
    email: "person@example.com",
    purpose: "signup-email-verification",
    codeDigest: "code-digest",
    hmacFormatVersion: 2,
    hmacKeyVersion: 1,
    attemptCount: 0,
    maxAttempts: 5,
    sessionTransport: "cookie",
    mobilePlatform: null,
    requestingIp: "203.0.113.4",
    expiresAt: new Date("2026-07-29T12:10:00.000Z"),
    createdAt,
    ...overrides,
  };
}

async function insertChallenge(
  database: Kysely<Database>,
  overrides: Partial<Insertable<Database["email_otp_challenges"]>> = {},
): Promise<void> {
  await database
    .insertInto("email_otp_challenges")
    .values({
      id: randomUUID(),
      email: "person@example.com",
      purpose: "signup-email-verification",
      code_digest: "existing-code-digest",
      hmac_format_version: 2,
      hmac_key_version: 1,
      attempt_count: 0,
      max_attempts: 5,
      session_transport: "cookie",
      mobile_platform: null,
      requesting_ip_digest: null,
      expires_at: new Date("2026-07-29T12:10:00.000Z"),
      consumed_at: null,
      invalidated_at: null,
      created_at: new Date("2026-07-29T11:58:00.000Z"),
      ...overrides,
    })
    .execute();
}

describe("PostgresEmailOtpChallengeRepository", () => {
  let database: Kysely<Database>;
  let repository: PostgresEmailOtpChallengeRepository;

  beforeAll(() => {
    database = createIntegrationDatabase();
    repository = new PostgresEmailOtpChallengeRepository({ ipDigestKey, globalHourlyLimit: 1000 }, database);
  });

  beforeEach(async () => {
    await clearIntegrationDatabase(database);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it("persists the challenge fields and stores only the requesting IP HMAC", async () => {
    const input = challenge({
      sessionTransport: "bearer",
      mobilePlatform: "ios",
    });

    await repository.create(input);

    const row = await database
      .selectFrom("email_otp_challenges")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirstOrThrow();

    expect(row).toMatchObject({
      id: input.id,
      email: input.email,
      purpose: input.purpose,
      code_digest: input.codeDigest,
      hmac_format_version: input.hmacFormatVersion,
      hmac_key_version: input.hmacKeyVersion,
      attempt_count: input.attemptCount,
      max_attempts: input.maxAttempts,
      session_transport: input.sessionTransport,
      mobile_platform: input.mobilePlatform,
      requesting_ip_digest: createHmac("sha256", ipDigestKey).update(input.requestingIp).digest("base64url"),
      expires_at: input.expiresAt,
      consumed_at: null,
      invalidated_at: null,
      created_at: input.createdAt,
    });
  });

  it("invalidates only the older active challenge with the same delivery binding", async () => {
    const matchingId = randomUUID();
    const otherPlatformId = randomUUID();
    await insertChallenge(database, {
      id: matchingId,
      session_transport: "bearer",
      mobile_platform: "ios",
    });
    await insertChallenge(database, {
      id: otherPlatformId,
      session_transport: "bearer",
      mobile_platform: "android",
    });

    await repository.create(
      challenge({
        sessionTransport: "bearer",
        mobilePlatform: "ios",
      }),
    );

    const rows = await database
      .selectFrom("email_otp_challenges")
      .select(["id", "invalidated_at"])
      .where("id", "in", [matchingId, otherPlatformId])
      .execute();

    expect(rows.find((row) => row.id === matchingId)?.invalidated_at).toEqual(createdAt);
    expect(rows.find((row) => row.id === otherPlatformId)?.invalidated_at).toBeNull();
  });

  it("rolls back invalidation when inserting the replacement fails", async () => {
    const previousId = randomUUID();
    const duplicateId = randomUUID();
    await insertChallenge(database, { id: previousId });
    await insertChallenge(database, {
      id: duplicateId,
      email: "other@example.com",
    });

    await expect(repository.create(challenge({ id: duplicateId }))).rejects.toMatchObject({
      code: "23505",
    });

    const previous = await database
      .selectFrom("email_otp_challenges")
      .select("invalidated_at")
      .where("id", "=", previousId)
      .executeTakeFirstOrThrow();

    expect(previous.invalidated_at).toBeNull();
  });

  it.each([
    {
      description: "rejects a request inside",
      ageMilliseconds: 59_000,
      shouldReject: true,
    },
    {
      description: "accepts a request at",
      ageMilliseconds: 60_000,
      shouldReject: false,
    },
  ])("$description the sixty-second cooldown boundary", async ({ ageMilliseconds, shouldReject }) => {
    await insertChallenge(database, {
      created_at: new Date(createdAt.getTime() - ageMilliseconds),
    });

    const operation = repository.create(challenge());

    if (shouldReject) {
      await expect(operation).rejects.toEqual(new RateLimitError("Too many verification-code requests"));
    } else {
      await expect(operation).resolves.toBeUndefined();
    }
  });

  it.each([
    ["email", 5, 1000],
    ["IP", 20, 1000],
    ["global", 2, 2],
  ])(
    "enforces the %s hourly limit against persisted rows",
    async (dimension, existingCount, globalHourlyLimit) => {
      const input = challenge();
      const expectedIpDigest = createHmac("sha256", ipDigestKey)
        .update(input.requestingIp)
        .digest("base64url");

      for (let index = 0; index < existingCount; index += 1) {
        await insertChallenge(database, {
          email: dimension === "email" ? input.email : `other-${index}@example.com`,
          requesting_ip_digest: dimension === "IP" ? expectedIpDigest : `unrelated-ip-digest-${index}`,
        });
      }

      const limitedRepository = new PostgresEmailOtpChallengeRepository(
        { ipDigestKey, globalHourlyLimit },
        database,
      );

      await expect(limitedRepository.create(input)).rejects.toEqual(
        new RateLimitError("Too many verification-code requests"),
      );
      await expect(
        database
          .selectFrom("email_otp_challenges")
          .select("id")
          .where("id", "=", input.id)
          .executeTakeFirst(),
      ).resolves.toBeUndefined();
    },
  );

  it("serializes concurrent creates so the global limit cannot be oversubscribed", async () => {
    const limitedRepository = new PostgresEmailOtpChallengeRepository(
      { ipDigestKey, globalHourlyLimit: 1 },
      database,
    );

    const results = await Promise.allSettled([
      limitedRepository.create(challenge()),
      limitedRepository.create(
        challenge({
          id: randomUUID(),
          email: "other@example.com",
          requestingIp: "203.0.113.5",
        }),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      reason: new RateLimitError("Too many verification-code requests"),
    });

    const count = await database
      .selectFrom("email_otp_challenges")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(1);
  });

  it("maps a stored row to the repository contract and returns null when absent", async () => {
    const id = randomUUID();
    const consumedAt = new Date("2026-07-29T12:01:00.000Z");
    const invalidatedAt = new Date("2026-07-29T12:02:00.000Z");
    await insertChallenge(database, {
      id,
      code_digest: "persisted-code-digest",
      hmac_format_version: 3,
      hmac_key_version: 4,
      attempt_count: 2,
      max_attempts: 7,
      session_transport: "bearer",
      mobile_platform: "android",
      expires_at: new Date("2026-07-29T12:20:00.000Z"),
      consumed_at: consumedAt,
      invalidated_at: invalidatedAt,
    });

    await expect(repository.findById(id)).resolves.toEqual({
      id,
      email: "person@example.com",
      purpose: "signup-email-verification",
      codeDigest: "persisted-code-digest",
      hmacFormatVersion: 3,
      hmacKeyVersion: 4,
      attemptCount: 2,
      maxAttempts: 7,
      sessionTransport: "bearer",
      mobilePlatform: "android",
      expiresAt: new Date("2026-07-29T12:20:00.000Z"),
      consumedAt,
      invalidatedAt,
    });
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
  });

  it("invalidates only a challenge that is active", async () => {
    const activeId = randomUUID();
    const consumedId = randomUUID();
    const alreadyInvalidatedId = randomUUID();
    const previousInvalidatedAt = new Date("2026-07-29T11:50:00.000Z");
    await insertChallenge(database, { id: activeId });
    await insertChallenge(database, {
      id: consumedId,
      consumed_at: new Date("2026-07-29T11:55:00.000Z"),
    });
    await insertChallenge(database, {
      id: alreadyInvalidatedId,
      invalidated_at: previousInvalidatedAt,
    });

    await Promise.all([
      repository.invalidate(activeId, createdAt),
      repository.invalidate(consumedId, createdAt),
      repository.invalidate(alreadyInvalidatedId, createdAt),
    ]);

    const rows = await database
      .selectFrom("email_otp_challenges")
      .select(["id", "invalidated_at"])
      .where("id", "in", [activeId, consumedId, alreadyInvalidatedId])
      .execute();

    expect(rows.find((row) => row.id === activeId)?.invalidated_at).toEqual(createdAt);
    expect(rows.find((row) => row.id === consumedId)?.invalidated_at).toBeNull();
    expect(rows.find((row) => row.id === alreadyInvalidatedId)?.invalidated_at).toEqual(
      previousInvalidatedAt,
    );
  });

  it("records failed attempts only while the challenge is usable and below its maximum", async () => {
    const activeId = randomUUID();
    const expiredId = randomUUID();
    const consumedId = randomUUID();
    const invalidatedId = randomUUID();
    const maximumId = randomUUID();
    await insertChallenge(database, { id: activeId });
    await insertChallenge(database, {
      id: expiredId,
      expires_at: new Date("2026-07-29T11:59:59.000Z"),
    });
    await insertChallenge(database, { id: consumedId, consumed_at: createdAt });
    await insertChallenge(database, { id: invalidatedId, invalidated_at: createdAt });
    await insertChallenge(database, { id: maximumId, attempt_count: 5 });

    await Promise.all(
      [activeId, expiredId, consumedId, invalidatedId, maximumId].map((id) =>
        repository.recordFailedAttempt(id, createdAt),
      ),
    );

    const rows = await database
      .selectFrom("email_otp_challenges")
      .select(["id", "attempt_count"])
      .where("id", "in", [activeId, expiredId, consumedId, invalidatedId, maximumId])
      .execute();

    expect(rows.find((row) => row.id === activeId)?.attempt_count).toBe(1);
    for (const unchangedId of [expiredId, consumedId, invalidatedId]) {
      expect(rows.find((row) => row.id === unchangedId)?.attempt_count).toBe(0);
    }
    expect(rows.find((row) => row.id === maximumId)?.attempt_count).toBe(5);
  });

  it("atomically caps concurrent failed-attempt increments", async () => {
    const id = randomUUID();
    await insertChallenge(database, { id });

    await Promise.all(Array.from({ length: 10 }, () => repository.recordFailedAttempt(id, createdAt)));

    const row = await database
      .selectFrom("email_otp_challenges")
      .select("attempt_count")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row.attempt_count).toBe(5);
  });
});
