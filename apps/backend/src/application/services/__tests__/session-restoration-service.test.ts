import type { IRefreshSessionRepository } from "@application/ports/access-session-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { IUserRepository } from "@application/ports/user-repository.js";
import { SessionRestorationServiceImpl } from "@application/services/session-restoration-service.js";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

describe("SessionRestorationServiceImpl.logout", () => {
  it("hashes access and refresh credentials before requesting family revocation", async () => {
    const revokeFamilyForLogout = vi.fn().mockResolvedValue(undefined);
    const sessions = {
      findActiveUserIdByTokenDigest: vi.fn(),
      refresh: vi.fn(),
      revokeFamilyForLogout,
    } as unknown as IRefreshSessionRepository;
    const service = new SessionRestorationServiceImpl(
      sessions,
      { create: vi.fn() } as unknown as IOpaqueTokenService,
      { findById: vi.fn() } as unknown as IUserRepository,
      { now: () => new Date("2026-08-03T12:00:00.000Z") },
    );

    await service.logout({ accessToken: "raw-access-token", refreshToken: "raw-refresh-token" });

    expect(revokeFamilyForLogout).toHaveBeenCalledWith({
      accessTokenDigest: digest("raw-access-token"),
      refreshTokenDigest: digest("raw-refresh-token"),
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
    expect(JSON.stringify(revokeFamilyForLogout.mock.calls)).not.toContain("raw-access-token");
    expect(JSON.stringify(revokeFamilyForLogout.mock.calls)).not.toContain("raw-refresh-token");
  });

  it("passes absent credentials as absent evidence for idempotent logout", async () => {
    const revokeFamilyForLogout = vi.fn().mockResolvedValue(undefined);
    const sessions = {
      findActiveUserIdByTokenDigest: vi.fn(),
      refresh: vi.fn(),
      revokeFamilyForLogout,
    } as unknown as IRefreshSessionRepository;
    const service = new SessionRestorationServiceImpl(
      sessions,
      { create: vi.fn() } as unknown as IOpaqueTokenService,
      { findById: vi.fn() } as unknown as IUserRepository,
      { now: () => new Date("2026-08-03T12:00:00.000Z") },
    );

    await service.logout({});

    expect(revokeFamilyForLogout).toHaveBeenCalledWith({
      accessTokenDigest: undefined,
      refreshTokenDigest: undefined,
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
  });
});
