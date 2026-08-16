import type { IClock } from "@application/ports/clock.js";
import type {
  CreateLocalDevelopmentTestSessionInput,
  ILocalDevelopmentTestSessionRepository,
} from "@application/ports/local-development-test-session-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";

import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_TEST_FIXTURE_EMAIL,
  LocalDevelopmentTestSessionService,
} from "./local-development-test-session-service.js";

describe("LocalDevelopmentTestSessionService", () => {
  it("creates one no-passkey fixture identity and a fresh cookie session generation", async () => {
    const persistedInputs: CreateLocalDevelopmentTestSessionInput[] = [];
    const repository: ILocalDevelopmentTestSessionRepository = {
      createOrReuseFixtureSession: vi.fn(async (input) => {
        persistedInputs.push(input);
        return {
          user: input.fixtureUser,
          accessInactivityExpiresAt: input.accessInactivityExpiresAt,
          accessAbsoluteExpiresAt: input.accessAbsoluteExpiresAt,
          familyInactivityExpiresAt: input.familyInactivityExpiresAt,
          familyAbsoluteExpiresAt: input.familyAbsoluteExpiresAt,
        };
      }),
    };
    const tokenService: IOpaqueTokenService = {
      create: vi
        .fn()
        .mockReturnValueOnce({ token: "raw-access-token", digest: "access-digest" })
        .mockReturnValueOnce({ token: "raw-refresh-token", digest: "refresh-digest" }),
    };
    const clock: IClock = { now: () => new Date("2026-08-16T12:00:00.000Z") };
    const service = new LocalDevelopmentTestSessionService(repository, tokenService, clock);

    const result = await service.create();

    expect(result).toMatchObject({
      accessToken: "raw-access-token",
      refreshToken: "raw-refresh-token",
      rememberDevice: true,
      accessInactivityExpiresAt: new Date("2026-08-16T12:30:00.000Z"),
      accessAbsoluteExpiresAt: new Date("2026-08-16T20:00:00.000Z"),
      familyInactivityExpiresAt: new Date("2026-08-23T12:00:00.000Z"),
      familyAbsoluteExpiresAt: new Date("2026-09-15T12:00:00.000Z"),
    });
    expect(result.user.email).toBe(LOCAL_TEST_FIXTURE_EMAIL);
    expect(result.user.webauthnUserHandle).toBeNull();
    expect(result.user.emailVerifiedAt).toBeNull();
    expect(persistedInputs).toHaveLength(1);
    expect(persistedInputs[0]).toMatchObject({
      accessTokenDigest: "access-digest",
      refreshTokenDigest: "refresh-digest",
      now: new Date("2026-08-16T12:00:00.000Z"),
      accessInactivityExpiresAt: new Date("2026-08-16T12:30:00.000Z"),
      accessAbsoluteExpiresAt: new Date("2026-08-16T20:00:00.000Z"),
      familyInactivityExpiresAt: new Date("2026-08-23T12:00:00.000Z"),
      familyAbsoluteExpiresAt: new Date("2026-09-15T12:00:00.000Z"),
      fixtureUser: expect.objectContaining({ email: LOCAL_TEST_FIXTURE_EMAIL }),
    });
    expect(JSON.stringify(persistedInputs)).not.toContain("raw-access-token");
    expect(JSON.stringify(persistedInputs)).not.toContain("raw-refresh-token");
  });

  it("requests a new access and refresh generation for every click", async () => {
    const repository: ILocalDevelopmentTestSessionRepository = {
      createOrReuseFixtureSession: vi.fn(async (input) => ({
        user: input.fixtureUser,
        accessInactivityExpiresAt: input.accessInactivityExpiresAt,
        accessAbsoluteExpiresAt: input.accessAbsoluteExpiresAt,
        familyInactivityExpiresAt: input.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: input.familyAbsoluteExpiresAt,
      })),
    };
    const tokenService: IOpaqueTokenService = {
      create: vi
        .fn()
        .mockReturnValueOnce({ token: "access-one", digest: "access-digest-one" })
        .mockReturnValueOnce({ token: "refresh-one", digest: "refresh-digest-one" })
        .mockReturnValueOnce({ token: "access-two", digest: "access-digest-two" })
        .mockReturnValueOnce({ token: "refresh-two", digest: "refresh-digest-two" }),
    };
    const service = new LocalDevelopmentTestSessionService(repository, tokenService, {
      now: () => new Date("2026-08-16T12:00:00.000Z"),
    });

    await service.create();
    await service.create();

    expect(repository.createOrReuseFixtureSession).toHaveBeenCalledTimes(2);
    expect(repository.createOrReuseFixtureSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accessTokenDigest: "access-digest-one",
        refreshTokenDigest: "refresh-digest-one",
      }),
    );
    expect(repository.createOrReuseFixtureSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accessTokenDigest: "access-digest-two",
        refreshTokenDigest: "refresh-digest-two",
      }),
    );
  });
});
