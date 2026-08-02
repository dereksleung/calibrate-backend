import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import type { IUserRepository } from "@application/ports/user-repository.js";
import type { IWebAuthnAuthenticationPort } from "@application/ports/webauthn-authentication-port.js";

import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";
import { User } from "@domain/entities/user.js";

import { PasskeyAuthenticationServiceImpl } from "../passkey-authentication-service.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const expectedOrigin = "http://localhost:3000";

function createService(
  overrides: {
    repository?: Partial<IPasskeyAuthenticationRepository>;
    webAuthn?: Partial<IWebAuthnAuthenticationPort>;
    opaqueTokenService?: Partial<IOpaqueTokenService>;
    userRepository?: Partial<IUserRepository>;
  } = {},
) {
  const repository: IPasskeyAuthenticationRepository = {
    prepareAuthentication: vi.fn(),
    consumeVerificationRateLimit: vi.fn(),
    findActiveCredential: vi.fn(),
    recordFailedVerificationAttempt: vi.fn(),
    completeAuthentication: vi.fn(),
    ...overrides.repository,
  };
  const webAuthn: IWebAuthnAuthenticationPort = {
    createAuthenticationOptions: vi.fn(),
    verifyAuthenticationResponse: vi.fn(),
    ...overrides.webAuthn,
  };
  const opaqueTokenService: IOpaqueTokenService = {
    create: vi.fn(),
    ...overrides.opaqueTokenService,
  };
  const userRepository: IUserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    save: vi.fn(),
    ...overrides.userRepository,
  };

  return {
    service: new PasskeyAuthenticationServiceImpl(
      repository,
      webAuthn,
      opaqueTokenService,
      userRepository,
      { now: () => now },
      { expectedOrigin },
    ),
    repository,
    webAuthn,
    opaqueTokenService,
    userRepository,
  };
}

describe("PasskeyAuthenticationServiceImpl", () => {
  it("rejects a missing user handle without calling the WebAuthn verifier", async () => {
    const challenge = "challenge";
    const { service, repository, webAuthn } = createService({
      repository: {
        findActiveCredential: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          userHandle: "user-handle",
          credentialId: "credential-id",
          publicKey: new Uint8Array([1]),
          signatureCounter: 0,
          transports: [],
          backupEligible: false,
          backupState: false,
        }),
      },
    });
    const credential = {
      id: "credential-id",
      rawId: "credential-id",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        authenticatorData: "data",
        clientDataJSON: Buffer.from(JSON.stringify({ challenge })).toString("base64url"),
        signature: "signature",
      },
    };

    await expect(
      service.verifyAuthentication({
        origin: expectedOrigin,
        requestingIp: "203.0.113.4",
        credential,
        rememberDevice: true,
      }),
    ).rejects.toMatchObject({ name: "PasskeyAuthenticationFailedError" });
    expect(repository.recordFailedVerificationAttempt).toHaveBeenCalledWith({
      challengeId: "challenge-id",
      now,
    });
    expect(webAuthn.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("rejects an unexpected origin before creating ceremony state", async () => {
    const { service, repository } = createService();

    await expect(
      service.createAuthenticationOptions({ origin: "https://evil.example", requestingIp: "203.0.113.4" }),
    ).rejects.toBeInstanceOf(OriginNotAllowedError);
    expect(repository.prepareAuthentication).not.toHaveBeenCalled();
  });

  it("creates usernameless options from a fresh digest-only challenge", async () => {
    const { service, repository, webAuthn } = createService({
      repository: {
        prepareAuthentication: vi.fn().mockImplementation(async (input) => ({
          challengeId: "challenge-id",
          rawChallenge: input.rawChallenge,
          challengeExpiresAt: new Date("2026-08-01T12:05:00.000Z"),
        })),
      },
      webAuthn: {
        createAuthenticationOptions: vi.fn().mockImplementation(async ({ rawChallenge }) => ({
          challenge: rawChallenge,
          rpId: "localhost",
          timeout: 300_000,
          userVerification: "required",
        })),
      },
    });

    const result = await service.createAuthenticationOptions({
      origin: expectedOrigin,
      requestingIp: "203.0.113.4",
    });

    const input = vi.mocked(repository.prepareAuthentication).mock.calls[0]?.[0];
    expect(input).toMatchObject({
      requestingIp: "203.0.113.4",
      now,
      maxOptionsRequestsPerIp: 40,
      globalHourlyLimit: 10_000,
      maxVerificationAttempts: 5,
    });
    expect(input?.rawChallenge).toHaveLength(43);
    expect(input?.challengeDigest).not.toBe(input?.rawChallenge);
    expect(webAuthn.createAuthenticationOptions).toHaveBeenCalledWith({ rawChallenge: input?.rawChallenge });
    expect(result).toEqual({
      options: {
        challenge: input?.rawChallenge,
        rpId: "localhost",
        timeout: 300_000,
        userVerification: "required",
      },
      expiresAt: new Date("2026-08-01T12:05:00.000Z"),
    });
  });

  it("atomically completes a verified assertion with digest-only credentials", async () => {
    const challenge = "challenge";
    const user = User.reconstitute({
      id: "user-id",
      email: "person@example.com",
      passwordHash: null,
      emailVerifiedAt: now,
      webauthnUserHandle: "user-handle",
      tier: "FREE",
      createdAt: now,
      updatedAt: now,
    });
    const { service, repository } = createService({
      repository: {
        findActiveCredential: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          userHandle: "user-handle",
          credentialId: "credential-id",
          publicKey: new Uint8Array([1]),
          signatureCounter: 1,
          transports: [],
          backupEligible: false,
          backupState: false,
        }),
        completeAuthentication: vi.fn().mockResolvedValue({ userId: user.id }),
      },
      webAuthn: {
        verifyAuthenticationResponse: vi.fn().mockResolvedValue({
          newCounter: 2,
          backupEligible: false,
          backupState: false,
        }),
      },
      opaqueTokenService: {
        create: vi
          .fn()
          .mockReturnValueOnce({ token: "raw-access-token", digest: "access-digest" })
          .mockReturnValueOnce({ token: "raw-refresh-token", digest: "refresh-digest" }),
      },
      userRepository: { findById: vi.fn().mockResolvedValue(user) },
    });
    const credential = {
      id: "credential-id",
      rawId: "credential-id",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        authenticatorData: "data",
        clientDataJSON: Buffer.from(JSON.stringify({ challenge })).toString("base64url"),
        signature: "signature",
        userHandle: "user-handle",
      },
    };

    await expect(
      service.verifyAuthentication({
        origin: expectedOrigin,
        requestingIp: "203.0.113.4",
        credential,
        rememberDevice: true,
      }),
    ).resolves.toMatchObject({
      user,
      accessToken: "raw-access-token",
      refreshToken: "raw-refresh-token",
      rememberDevice: true,
    });
    expect(repository.completeAuthentication).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeDigest: expect.any(String),
        credentialId: "credential-id",
        newCounter: 2,
        backupState: false,
        counterAnomaly: false,
        accessTokenDigest: "access-digest",
        refreshTokenDigest: "refresh-digest",
      }),
    );
  });
});
