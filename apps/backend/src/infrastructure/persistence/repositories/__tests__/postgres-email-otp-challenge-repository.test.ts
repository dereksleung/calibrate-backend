import type { CompiledQuery, DatabaseConnection, Driver, QueryResult, TransactionSettings } from "kysely";

import { RateLimitError, type NewEmailOtpChallenge } from "@application";
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import { createHmac } from "node:crypto";

import type { Database } from "../../database.js";

import { PostgresEmailOtpChallengeRepository } from "../postgres-email-otp-challenge-repository.js";

interface ScriptedRows {
  latestCreatedAt?: Date;
  emailCount?: number;
  ipCount?: number;
  globalCount?: number;
}

class RecordingConnection implements DatabaseConnection {
  readonly queries: CompiledQuery[] = [];

  constructor(private readonly rows: ScriptedRows) {}

  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    this.queries.push(query);

    if (query.sql.startsWith('select "created_at"')) {
      return {
        rows: this.rows.latestCreatedAt ? ([{ created_at: this.rows.latestCreatedAt }] as R[]) : [],
      };
    }

    if (query.sql.includes('count(*) as "count"')) {
      const count = query.sql.includes('"email" =')
        ? this.rows.emailCount
        : query.sql.includes('"requesting_ip_digest" =')
          ? this.rows.ipCount
          : this.rows.globalCount;

      return { rows: [{ count: count ?? 0 }] as R[] };
    }

    return { rows: [] };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    yield { rows: [] };
  }
}

class RecordingDriver implements Driver {
  readonly connection: RecordingConnection;
  transactionStarts = 0;

  constructor(rows: ScriptedRows = {}) {
    this.connection = new RecordingConnection(rows);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(_connection: DatabaseConnection, _settings: TransactionSettings): Promise<void> {
    this.transactionStarts += 1;
  }

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

function createDatabase(driver: RecordingDriver): Kysely<Database> {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

const createdAt = new Date("2026-07-26T12:00:00.000Z");

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
    expiresAt: new Date("2026-07-26T12:10:00.000Z"),
    createdAt,
    ...overrides,
  };
}

function createRepository(rows: ScriptedRows = {}, globalHourlyLimit = 1000) {
  const driver = new RecordingDriver(rows);
  const ipDigestKey = Buffer.alloc(32, 9);
  const repository = new PostgresEmailOtpChallengeRepository(
    { ipDigestKey, globalHourlyLimit },
    createDatabase(driver),
  );

  return { driver, ipDigestKey, repository };
}

describe("PostgresEmailOtpChallengeRepository.create", () => {
  it("locks, invalidates the matching binding, and stores only the IP HMAC", async () => {
    const { driver, ipDigestKey, repository } = createRepository();
    const input = challenge({
      sessionTransport: "bearer",
      mobilePlatform: "ios",
    });

    await repository.create(input);

    expect(driver.transactionStarts).toBe(1);
    const lockQuery = driver.connection.queries.find((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(lockQuery?.parameters).toEqual([1_426_374_925]);

    const invalidation = driver.connection.queries.find((query) =>
      query.sql.startsWith('update "email_otp_challenges"'),
    );
    expect(invalidation?.sql).toContain('"session_transport" =');
    expect(invalidation?.sql).toContain('"mobile_platform" =');
    expect(invalidation?.parameters).toEqual(
      expect.arrayContaining(["person@example.com", "signup-email-verification", "bearer", "ios"]),
    );

    const insert = driver.connection.queries.find((query) =>
      query.sql.startsWith('insert into "email_otp_challenges"'),
    );
    const expectedIpDigest = createHmac("sha256", ipDigestKey).update(input.requestingIp).digest("base64url");
    expect(insert?.parameters).toContain(expectedIpDigest);
    expect(insert?.parameters).not.toContain(input.requestingIp);
    expect(insert?.parameters).toEqual(
      expect.arrayContaining(["signup-email-verification", "bearer", "ios"]),
    );

    const globalCount = driver.connection.queries.find(
      (query) =>
        query.sql.includes('count(*) as "count"') &&
        !query.sql.includes('"email" =') &&
        !query.sql.includes('"requesting_ip_digest" ='),
    );
    expect(globalCount?.sql).not.toContain('"purpose" =');
  });

  it("enforces the sixty-second cooldown before inserting", async () => {
    const { driver, repository } = createRepository({
      latestCreatedAt: new Date(createdAt.getTime() - 59_000),
    });

    await expect(repository.create(challenge())).rejects.toBeInstanceOf(RateLimitError);
    expect(
      driver.connection.queries.some((query) => query.sql.startsWith('insert into "email_otp_challenges"')),
    ).toBe(false);
  });

  it.each([
    ["email", { emailCount: 5 }, 1000],
    ["IP", { ipCount: 20 }, 1000],
    ["global", { globalCount: 2 }, 2],
  ])(
    "rejects the %s hourly limit with the generic rate-limit error",
    async (_dimension, rows, globalHourlyLimit) => {
      const { driver, repository } = createRepository(rows, globalHourlyLimit);

      await expect(repository.create(challenge())).rejects.toEqual(
        new RateLimitError("Too many verification-code requests"),
      );
      expect(
        driver.connection.queries.some((query) => query.sql.startsWith('insert into "email_otp_challenges"')),
      ).toBe(false);
    },
  );

  it("takes the fixed delivery lock for each concurrent request", async () => {
    const { driver, repository } = createRepository();

    await Promise.all([
      repository.create(challenge()),
      repository.create(
        challenge({
          id: "7534698d-ab5b-455d-8739-3a41ed1458cc",
          email: "other@example.com",
        }),
      ),
    ]);

    expect(
      driver.connection.queries.filter((query) => query.sql.includes("pg_advisory_xact_lock")),
    ).toHaveLength(2);
  });
});
