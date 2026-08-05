import { describe, expect, it, vi } from "vitest";
import { User } from "@domain/entities/user.js";

import { RecoveryPasskeyRegistrationServiceImpl } from "../recovery-passkey-registration-service.js";

describe("RecoveryPasskeyRegistrationServiceImpl", () => {
  it("uses the account's stable handle and excludes every active credential", async () => {
    const repository = {
      prepareRegistration: vi.fn().mockResolvedValue({
        userHandle: "stable-user-handle",
        email: "person@example.com",
        rawChallenge: "challenge",
        excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
      }),
      findActiveChallenge: vi.fn(),
      recordFailedVerificationAttempt: vi.fn(),
      completeRegistration: vi.fn(),
    };
    const webAuthn = {
      createRegistrationOptions: vi.fn().mockResolvedValue({ challenge: "challenge" }),
      verifyRegistrationResponse: vi.fn(),
    };
    const service = new RecoveryPasskeyRegistrationServiceImpl(repository, webAuthn, { now: () => new Date() }, { expectedOrigin: "http://localhost:3000" });

    await service.createRegistrationOptions("recovery-registration-token", "http://localhost:3000");

    expect(webAuthn.createRegistrationOptions).toHaveBeenCalledWith({
      userHandle: "stable-user-handle",
      email: "person@example.com",
      rawChallenge: "challenge",
      excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
    });
  });

  it("verifies before completing a provisional restricted registration", async () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const user = User.reconstitute({
      id: "user-1",
      email: "person@example.com",
      passwordHash: null,
      emailVerifiedAt: now,
      webauthnUserHandle: "stable-handle",
      tier: "FREE",
      createdAt: now,
      updatedAt: now,
    });
    const repository = {
      prepareRegistration: vi.fn(),
      findActiveChallenge: vi.fn().mockResolvedValue({ challengeId: "challenge-1" }),
      recordFailedVerificationAttempt: vi.fn(),
      completeRegistration: vi.fn().mockResolvedValue({
        user,
        accessInactivityExpiresAt: new Date("2026-08-05T12:15:00.000Z"),
        familyInactivityExpiresAt: new Date("2026-08-12T12:00:00.000Z"),
        familyAbsoluteExpiresAt: new Date("2026-09-04T12:00:00.000Z"),
      }),
    };
    const webAuthn = {
      createRegistrationOptions: vi.fn(),
      verifyRegistrationResponse: vi.fn().mockResolvedValue({
        credentialId: "new-credential",
        publicKey: new Uint8Array([1, 2]),
        algorithm: -7,
        transports: ["internal"],
        signatureCounter: 0,
        aaguid: "aaguid",
        backupEligible: true,
        backupState: true,
      }),
    };
    const service = new RecoveryPasskeyRegistrationServiceImpl(repository, webAuthn, { now: () => now }, { expectedOrigin: "http://localhost:3000" });
    const challenge = Buffer.from(JSON.stringify({ challenge: "browser-challenge" })).toString("base64url");

    const result = await service.verifyRegistration({
      recoveryRegistrationToken: "registration-token",
      origin: "http://localhost:3000",
      attestation: { credentialId: "new-credential", rawCredentialId: "new-credential", clientDataJSON: challenge, attestationObject: "attestation" },
      rememberDevice: true,
    });

    expect(webAuthn.verifyRegistrationResponse).toHaveBeenCalledWith(expect.objectContaining({ expectedChallenge: "browser-challenge" }));
    expect(repository.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({
      restrictionEndsAt: new Date("2026-08-10T12:00:00.000Z"),
      passkey: expect.objectContaining({ credentialId: "new-credential" }),
    }));
    expect(result).toMatchObject({ user, rememberDevice: true });
  });
});
