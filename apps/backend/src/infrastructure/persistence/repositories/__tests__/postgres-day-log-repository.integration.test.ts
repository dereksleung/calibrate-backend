import { buildFoodEntry } from "@factories/food-entry.js";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../../database-client.js";
import type { InsertableUser } from "../../schemas/users-table.js";

import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../../../test/integration/database.js";
import { PostgresDayLogRepository } from "../postgres-day-log-repository.js";

const now = new Date("2026-08-06T12:00:00.000Z");

async function insertUser(databaseClient: DatabaseClient, email: string): Promise<string> {
  const userInput: InsertableUser & { id: string } = {
    id: randomUUID(),
    email,
    password_hash: null,
    email_verified_at: now,
    webauthn_user_handle: `${email}-handle`,
    tier: "FREE",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const user = await databaseClient
    .insertInto("users")
    .values(userInput)
    .returning("id")
    .executeTakeFirstOrThrow();
  return user.id;
}

async function insertDayLog(
  databaseClient: DatabaseClient,
  input: { userId: string; date: string; versionNumber?: number },
): Promise<string> {
  const id = randomUUID();
  await databaseClient
    .insertInto("day_logs")
    .values({
      id,
      date: input.date,
      user_id: input.userId,
      weight: null,
      version_number: input.versionNumber,
    })
    .execute();
  return id;
}

describe("PostgresDayLogRepository day log sync", () => {
  let databaseClient: DatabaseClient;
  let repository: PostgresDayLogRepository;

  beforeAll(() => {
    databaseClient = createIntegrationDatabaseClient();
    repository = new PostgresDayLogRepository(databaseClient);
  });

  beforeEach(async () => {
    await clearIntegrationDatabase(databaseClient);
  });

  afterAll(async () => {
    await databaseClient.destroy();
  });

  it("initializes a newly created day log at version 1 and advances it atomically with a food entry write", async () => {
    const userId = await insertUser(databaseClient, "owner@example.com");
    const dayLog = await repository.findOrCreateByDateAndUserId({ userId, date: "2026-08-06" });

    expect(dayLog.versionNumber).toBe(1);

    await repository.addFoodEntry(
      dayLog.id,
      buildFoodEntry({ id: randomUUID(), dayLogId: dayLog.id, name: "Oats" }),
    );

    const persisted = await databaseClient
      .selectFrom("day_logs")
      .select(["version_number"])
      .where("id", "=", dayLog.id)
      .executeTakeFirstOrThrow();

    expect(persisted.version_number).toBe(2);
  });

  it("backfills omitted version numbers to 1", async () => {
    const userId = await insertUser(databaseClient, "owner@example.com");
    await insertDayLog(databaseClient, { userId, date: "2026-08-06" });

    await expect(
      repository.readCoherentSnapshot({
        userId,
        startDate: "2026-08-06",
        endDate: "2026-08-06",
        known: { "2026-08-06": 1 },
      }),
    ).resolves.toEqual({ status: "unchanged" });
  });

  it("returns unchanged for a matching contiguous range, including Known-empty dates", async () => {
    const userId = await insertUser(databaseClient, "owner@example.com");
    const dayLogId = await insertDayLog(databaseClient, { userId, date: "2026-08-06", versionNumber: 4 });
    await repository.addFoodEntry(dayLogId, buildFoodEntry({ id: randomUUID(), dayLogId, name: "Eggs" }));

    await expect(
      repository.readCoherentSnapshot({
        userId,
        startDate: "2026-08-06",
        endDate: "2026-08-07",
        known: { "2026-08-06": 5, "2026-08-07": null },
      }),
    ).resolves.toEqual({ status: "unchanged" });
  });

  it("returns only changed or unloaded slots and isolates users", async () => {
    const ownerId = await insertUser(databaseClient, "owner@example.com");
    const otherId = await insertUser(databaseClient, "other@example.com");
    const matchingId = await insertDayLog(databaseClient, {
      userId: ownerId,
      date: "2026-08-06",
      versionNumber: 2,
    });
    await insertDayLog(databaseClient, { userId: ownerId, date: "2026-08-08", versionNumber: 1 });
    await insertDayLog(databaseClient, { userId: otherId, date: "2026-08-07", versionNumber: 9 });
    await repository.addFoodEntry(
      matchingId,
      buildFoodEntry({ id: randomUUID(), dayLogId: matchingId, name: "Owner breakfast" }),
    );

    const result = await repository.readCoherentSnapshot({
      userId: ownerId,
      startDate: "2026-08-06",
      endDate: "2026-08-08",
      known: { "2026-08-06": 2, "2026-08-08": 1 },
    });

    expect(result.status).toBe("changed");
    if (result.status !== "changed") return;

    expect(result.slots.map((slot) => slot.date)).toEqual(["2026-08-06", "2026-08-07"]);
    expect(result.slots[0]).toMatchObject({
      date: "2026-08-06",
      versionNumber: 3,
    });
    expect(result.slots[0]?.dayLog?.breakfast?.map((entry) => entry.name)).toEqual(["Owner breakfast"]);
    expect(result.slots[1]).toEqual({
      date: "2026-08-07",
      versionNumber: null,
      dayLog: null,
    });
  });

  it("treats a present empty day log as distinct from Known-empty", async () => {
    const userId = await insertUser(databaseClient, "owner@example.com");
    await insertDayLog(databaseClient, { userId, date: "2026-08-06", versionNumber: 1 });

    const result = await repository.readCoherentSnapshot({
      userId,
      startDate: "2026-08-06",
      endDate: "2026-08-06",
      known: { "2026-08-06": null },
    });

    expect(result).toMatchObject({
      status: "changed",
      slots: [{ date: "2026-08-06", versionNumber: 1 }],
    });
    if (result.status === "changed") {
      expect(result.slots[0]?.dayLog).not.toBeNull();
    }
  });
});
