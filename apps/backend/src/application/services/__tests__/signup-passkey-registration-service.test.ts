import type { ISignupPasskeyRegistrationRepository } from "@application/ports/signup-passkey-registration-repository.js";
import type { IWebAuthnRegistrationPort } from "@application/ports/webauthn-registration-port.js";

import {
  EnrollmentAuthorizationRequiredError,
  OriginNotAllowedError,
  PasskeyRegistrationFailedError,
  PasskeyRegistrationStateConflictError,
} from "@application/errors/passkey-registration-errors.js";
import { User } from "@domain/entities/user.js";
import { createHash, randomBytes } from "node:crypto";

import {
  SignupPasskeyRegistrationServiceImpl,
  digestChallenge,
  digestEnrollmentToken,
} from "../signup-passkey-registration-service.js";

const now = new Date("2026-07-31T12:00:00.000Z");
const expectedOrigin = "http://localhost:3000";

function createService(overrides: {
  repository?: Partial<ISignupPasskeyRegistrationRepository>;
  webAuthn?: Partial<IWebAuthnRegistrationPort>;
}) {
  const repository: ISignupPasskeyRegistrationRepository = {
    prepareRegistration: vi.fn(),
    findActiveChallenge: vi.fn(),
    recordFailedVerificationAttempt: vi.fn(),
    completeRegistration: vi.fn(),
    ...overrides.repository,
  };
  const webAuthn: IWebAuthnRegistrationPort = {
    createRegistrationOptions: vi.fn(),
    verifyRegistrationResponse: vi.fn(),
    ...overrides.webAuthn,
  };

  return {
    service: new SignupPasskeyRegistrationServiceImpl(
      repository,
      webAuthn,
      { create: () => ({ token: "access-token", digest: "access-digest" }) },
      {
        sendPasskeyAddedNotification: vi.fn().mockResolvedValue(undefined),
        sendAccountEmailVerificationCode: vi.fn(),
      },
      { now: () => now },
      { expectedOrigin },
    ),
    repository,
    webAuthn,
  };
}

function registrationAttestation(challenge: string) {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.create", challenge, origin: expectedOrigin }),
  ).toString("base64url");

  return {
    credentialId: "credential-id",
    rawCredentialId: "credential-id",
    clientDataJSON,
    attestationObject: "attestation",
  };
}

describe("SignupPasskeyRegistrationServiceImpl", () => {
  it("rejects an unexpected origin before touching ceremony state", async () => {
    const { service, repository } = createService({});

    await expect(
      service.createRegistrationOptions("enrollment-token", "https://evil.example"),
    ).rejects.toBeInstanceOf(OriginNotAllowedError);

    expect(repository.prepareRegistration).not.toHaveBeenCalled();
  });

  it("returns WebAuthn options from the trusted challenge and stable user handle", async () => {
    const { service, repository, webAuthn } = createService({
      repository: {
        prepareRegistration: vi.fn().mockImplementation(async (input) => ({
          enrollmentAuthorizationId: "enrollment-id",
          challengeId: "challenge-id",
          email: "person@example.com",
          userHandle: "user-handle",
          rawChallenge: input.rawChallenge,
          challengeExpiresAt: new Date("2026-07-31T12:05:00.000Z"),
        })),
      },
      webAuthn: {
        createRegistrationOptions: vi.fn().mockImplementation(async (input) => ({
          challenge: input.rawChallenge,
          rp: { name: "Calibrate", id: "localhost" },
          user: {
            id: input.userHandle,
            name: input.email,
            displayName: input.email,
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        })),
      },
    });

    const result = await service.createRegistrationOptions("enrollment-token", expectedOrigin);

    expect(repository.prepareRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentTokenDigest: digestEnrollmentToken("enrollment-token"),
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
        now,
      }),
    );
    const prepareInput = vi.mocked(repository.prepareRegistration).mock.calls[0]?.[0];
    expect(prepareInput?.rawChallenge).toBeTruthy();
    expect(prepareInput?.challengeDigest).toBe(digestChallenge(prepareInput!.rawChallenge));
    expect(webAuthn.createRegistrationOptions).toHaveBeenCalledWith({
      userHandle: "user-handle",
      email: "person@example.com",
      rawChallenge: prepareInput!.rawChallenge,
    });
    const rawChallenge = prepareInput!.rawChallenge;
    expect(result.options).toEqual({
      challenge: rawChallenge,
      rp: { name: "Calibrate", id: "localhost" },
      user: {
        id: "user-handle",
        name: "person@example.com",
        displayName: "person@example.com",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    });
  });

  it("verifies the client challenge against the active challenge binding", async () => {
    const rawChallenge = randomBytes(32).toString("base64url");
    const attestation = registrationAttestation(rawChallenge);
    const { service, repository, webAuthn } = createService({
      repository: {
        findActiveChallenge: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          enrollmentAuthorizationId: "enrollment-id",
          email: "person@example.com",
          userHandle: "user-handle",
          challengeExpiresAt: new Date("2026-07-31T12:05:00.000Z"),
          attemptCount: 0,
          maxAttempts: 5,
        }),
        completeRegistration: vi.fn().mockResolvedValue({
          user: User.createForPasskeySignup({
            email: "person@example.com",
            webauthnUserHandle: "user-handle",
            emailVerifiedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accessInactivityExpiresAt: new Date("2026-07-31T12:30:00.000Z"),
          familyInactivityExpiresAt: new Date("2026-08-07T12:00:00.000Z"),
          familyAbsoluteExpiresAt: new Date("2026-08-30T12:00:00.000Z"),
        }),
      },
      webAuthn: {
        verifyRegistrationResponse: vi.fn().mockResolvedValue({
          credentialId: "credential-id",
          publicKey: new Uint8Array([1, 2, 3]),
          algorithm: -7,
          transports: ["internal"],
          signatureCounter: 0,
          aaguid: "00000000-0000-0000-0000-000000000000",
          backupEligible: true,
          backupState: false,
        }),
      },
    });

    const result = await service.verifyRegistration({
      enrollmentToken: "enrollment-token",
      origin: expectedOrigin,
      attestation,
      rememberDevice: true,
    });

    expect(webAuthn.verifyRegistrationResponse).toHaveBeenCalledWith({
      attestation,
      expectedChallenge: rawChallenge,
      expectedOrigin,
    });
    expect(result.accessToken).toBe("access-token");
    expect(result.rememberDevice).toBe(true);
    expect(repository.recordFailedVerificationAttempt).not.toHaveBeenCalled();
  });

  it("records a failed attempt and returns a generic failure for invalid WebAuthn verification", async () => {
    const rawChallenge = randomBytes(32).toString("base64url");
    const { service, repository } = createService({
      repository: {
        findActiveChallenge: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          enrollmentAuthorizationId: "enrollment-id",
          email: "person@example.com",
          userHandle: "user-handle",
          challengeExpiresAt: new Date("2026-07-31T12:05:00.000Z"),
          attemptCount: 0,
          maxAttempts: 5,
        }),
      },
      webAuthn: {
        verifyRegistrationResponse: vi.fn().mockRejectedValue(new Error("bad signature")),
      },
    });

    await expect(
      service.verifyRegistration({
        enrollmentToken: "enrollment-token",
        origin: expectedOrigin,
        attestation: registrationAttestation(rawChallenge),
        rememberDevice: false,
      }),
    ).rejects.toBeInstanceOf(PasskeyRegistrationFailedError);

    expect(repository.recordFailedVerificationAttempt).toHaveBeenCalledWith({
      challengeId: "challenge-id",
      now,
    });
  });

  it("requires an active enrollment challenge binding", async () => {
    const { service } = createService({
      repository: {
        findActiveChallenge: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.verifyRegistration({
        enrollmentToken: "enrollment-token",
        origin: expectedOrigin,
        attestation: registrationAttestation(randomBytes(32).toString("base64url")),
        rememberDevice: true,
      }),
    ).rejects.toBeInstanceOf(EnrollmentAuthorizationRequiredError);
  });

  it("maps repository completion conflicts to a safe conflict error", async () => {
    const rawChallenge = randomBytes(32).toString("base64url");
    const { service } = createService({
      repository: {
        findActiveChallenge: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          enrollmentAuthorizationId: "enrollment-id",
          email: "person@example.com",
          userHandle: "user-handle",
          challengeExpiresAt: new Date("2026-07-31T12:05:00.000Z"),
          attemptCount: 0,
          maxAttempts: 5,
        }),
        completeRegistration: vi.fn().mockRejectedValue(new PasskeyRegistrationStateConflictError()),
      },
      webAuthn: {
        verifyRegistrationResponse: vi.fn().mockResolvedValue({
          credentialId: "credential-id",
          publicKey: new Uint8Array([1, 2, 3]),
          algorithm: -7,
          transports: ["internal"],
          signatureCounter: 0,
          aaguid: "00000000-0000-0000-0000-000000000000",
          backupEligible: true,
          backupState: false,
        }),
      },
    });

    await expect(
      service.verifyRegistration({
        enrollmentToken: "enrollment-token",
        origin: expectedOrigin,
        attestation: registrationAttestation(rawChallenge),
        rememberDevice: true,
      }),
    ).rejects.toBeInstanceOf(PasskeyRegistrationStateConflictError);
  });
});

describe("digest helpers", () => {
  it("hashes enrollment tokens and challenges as base64url digests", () => {
    const value = "opaque-token";
    expect(digestEnrollmentToken(value)).toBe(createHash("sha256").update(value).digest("base64url"));
    expect(digestChallenge("challenge")).toBe(createHash("sha256").update("challenge").digest("base64url"));
  });
});
