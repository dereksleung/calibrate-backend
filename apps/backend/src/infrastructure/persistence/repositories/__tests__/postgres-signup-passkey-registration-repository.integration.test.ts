import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  EnrollmentAuthorizationRequiredError,
  PasskeyRegistrationRateLimitedError,
} from "@application/errors/passkey-registration-errors.js";
import { User } from "@domain/entities/user.js";

import type { DatabaseClient } from "../../database-client.js";

import {
  clearIntegrationDatabase,
  createIntegrationDatabaseClient,
} from "../../../../../test/integration/database.js";
import { PostgresSignupPasskeyRegistrationRepository } from "../postgres-signup-passkey-registration-repository.js";

const createdAt = new Date("2026-07-31T12:00:00.000Z");
const expiresAt = new Date("2026-07-31T12:05:00.000Z");

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

async function insertEnrollmentAuthorization(
  databaseClient: DatabaseClient,
  overrides: {
    id?: string;
    email?: string;
    tokenDigest?: string;
    webauthnUserHandle?: string | null;
    consumedAt?: Date | null;
    invalidatedAt?: Date | null;
    expiresAt?: Date;
  } = {},
): Promise<{ id: string; tokenDigest: string; email: string }> {
  const id = overrides.id ?? randomUUID();
  const tokenDigest = overrides.tokenDigest ?? digest(randomBytes(32).toString("base64url"));
  const email = overrides.email ?? "person@example.com";

  await databaseClient
    .insertInto("signup_enrollment_authorizations")
    .values({
      id,
      email,
      token_digest: tokenDigest,
      session_transport: "cookie",
      mobile_platform: null,
      webauthn_user_handle: overrides.webauthnUserHandle ?? null,
      created_at: createdAt,
      expires_at: overrides.expiresAt ?? expiresAt,
      consumed_at: overrides.consumedAt ?? null,
      invalidated_at: overrides.invalidatedAt ?? null,
    })
    .execute();

  return { id, tokenDigest, email };
}

describe("PostgresSignupPasskeyRegistrationRepository", () => {
  let databaseClient: DatabaseClient;
  let repository: PostgresSignupPasskeyRegistrationRepository;

  beforeAll(() => {
    databaseClient = createIntegrationDatabaseClient();
    repository = new PostgresSignupPasskeyRegistrationRepository(databaseClient);
  });

  beforeEach(async () => {
    await clearIntegrationDatabase(databaseClient);
  });

  afterAll(async () => {
    await databaseClient.destroy();
  });

  describe("prepareRegistration", () => {
    it("assigns a stable user handle and stores only the challenge digest", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient);
      const rawChallenge = randomBytes(32).toString("base64url");

      const first = await repository.prepareRegistration({
        enrollmentTokenDigest: enrollment.tokenDigest,
        candidateUserHandle: randomBytes(32).toString("base64url"),
        rawChallenge,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
      });

      const secondChallenge = randomBytes(32).toString("base64url");
      const second = await repository.prepareRegistration({
        enrollmentTokenDigest: enrollment.tokenDigest,
        candidateUserHandle: randomBytes(32).toString("base64url"),
        rawChallenge: secondChallenge,
        challengeDigest: digest(secondChallenge),
        now: new Date(createdAt.getTime() + 1_000),
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
      });

      expect(first.userHandle).toBe(second.userHandle);
      expect(first.email).toBe(enrollment.email);
      expect(first.rawChallenge).toBe(rawChallenge);
      expect(second.rawChallenge).toBe(secondChallenge);

      const storedChallenges = await databaseClient
        .selectFrom("webauthn_challenges")
        .selectAll()
        .where("enrollment_authorization_id", "=", enrollment.id)
        .orderBy("created_at", "asc")
        .execute();

      expect(storedChallenges).toHaveLength(2);
      expect(storedChallenges[0]?.invalidated_at).not.toBeNull();
      expect(storedChallenges[1]?.invalidated_at).toBeNull();
      expect(storedChallenges.every((row) => row.challenge_digest === digest(rawChallenge) || row.challenge_digest === digest(secondChallenge))).toBe(true);
      expect(storedChallenges.some((row) => row.challenge_digest === rawChallenge)).toBe(false);
    });

    it("rejects missing or expired enrollment authorization", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient, {
        expiresAt: new Date("2026-07-31T11:59:00.000Z"),
      });
      const rawChallenge = randomBytes(32).toString("base64url");

      await expect(
        repository.prepareRegistration({
          enrollmentTokenDigest: enrollment.tokenDigest,
          candidateUserHandle: randomBytes(32).toString("base64url"),
          rawChallenge,
          challengeDigest: digest(rawChallenge),
          now: createdAt,
          maxOptionsRequests: 5,
          maxVerificationAttempts: 5,
        }),
      ).rejects.toBeInstanceOf(EnrollmentAuthorizationRequiredError);
    });

    it("enforces the persisted options-request limit", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient);

      for (let index = 0; index < 5; index++) {
        const rawChallenge = randomBytes(32).toString("base64url");
        await repository.prepareRegistration({
          enrollmentTokenDigest: enrollment.tokenDigest,
          candidateUserHandle: randomBytes(32).toString("base64url"),
          rawChallenge,
          challengeDigest: digest(rawChallenge),
          now: new Date(createdAt.getTime() + index * 1_000),
          maxOptionsRequests: 5,
          maxVerificationAttempts: 5,
        });
      }

      const rawChallenge = randomBytes(32).toString("base64url");
      await expect(
        repository.prepareRegistration({
          enrollmentTokenDigest: enrollment.tokenDigest,
          candidateUserHandle: randomBytes(32).toString("base64url"),
          rawChallenge,
          challengeDigest: digest(rawChallenge),
          now: new Date(createdAt.getTime() + 6_000),
          maxOptionsRequests: 5,
          maxVerificationAttempts: 5,
        }),
      ).rejects.toBeInstanceOf(PasskeyRegistrationRateLimitedError);
    });
  });

  describe("findActiveChallenge", () => {
    it("returns the active challenge binding without a stored raw challenge", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient);
      const rawChallenge = randomBytes(32).toString("base64url");
      const prepared = await repository.prepareRegistration({
        enrollmentTokenDigest: enrollment.tokenDigest,
        candidateUserHandle: randomBytes(32).toString("base64url"),
        rawChallenge,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
      });

      const active = await repository.findActiveChallenge({
        enrollmentTokenDigest: enrollment.tokenDigest,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
      });

      expect(active).toEqual({
        challengeId: prepared.challengeId,
        enrollmentAuthorizationId: enrollment.id,
        email: enrollment.email,
        userHandle: prepared.userHandle,
        challengeExpiresAt: expiresAt,
        attemptCount: 0,
        maxAttempts: 5,
      });
    });
  });

  describe("completeRegistration", () => {
    it("atomically creates the user, passkey, family, session, and security event", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient);
      const rawChallenge = randomBytes(32).toString("base64url");
      const prepared = await repository.prepareRegistration({
        enrollmentTokenDigest: enrollment.tokenDigest,
        candidateUserHandle: randomBytes(32).toString("base64url"),
        rawChallenge,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
      });

      const user = User.createForPasskeySignup({
        email: prepared.email,
        webauthnUserHandle: prepared.userHandle,
        emailVerifiedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      });
      const accessToken = randomBytes(32).toString("base64url");
      const refreshToken = randomBytes(32).toString("base64url");
      const securityEventId = randomUUID();

      const result = await repository.completeRegistration(
        {
          enrollmentTokenDigest: enrollment.tokenDigest,
          challengeDigest: digest(rawChallenge),
          now: createdAt,
          user,
          passkey: {
            credentialId: "credential-id",
            publicKey: new Uint8Array([1, 2, 3]),
            algorithm: -7,
            transports: ["internal"],
            signatureCounter: 0,
            aaguid: "00000000-0000-0000-0000-000000000000",
            backupEligible: true,
            backupState: false,
          },
          accessTokenDigest: digest(accessToken),
          refreshTokenDigest: digest(refreshToken),
          accessInactivityExpiresAt: new Date("2026-07-31T12:30:00.000Z"),
          accessAbsoluteExpiresAt: new Date("2026-07-31T20:00:00.000Z"),
          familyInactivityExpiresAt: new Date("2026-08-07T12:00:00.000Z"),
          familyAbsoluteExpiresAt: new Date("2026-08-30T12:00:00.000Z"),
          securityEventId,
        },
        accessToken,
        refreshToken,
      );

      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
      expect(result.user.email).toBe(prepared.email);

      const authorization = await databaseClient
        .selectFrom("signup_enrollment_authorizations")
        .selectAll()
        .where("id", "=", enrollment.id)
        .executeTakeFirstOrThrow();
      expect(authorization.consumed_at).not.toBeNull();

      const challenge = await databaseClient
        .selectFrom("webauthn_challenges")
        .selectAll()
        .where("id", "=", prepared.challengeId)
        .executeTakeFirstOrThrow();
      expect(challenge.consumed_at).not.toBeNull();

      const sessions = await databaseClient.selectFrom("sessions").selectAll().execute();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.token_digest).toBe(digest(accessToken));
      expect(sessions[0]?.token_digest).not.toBe(accessToken);

      const refreshGenerations = await databaseClient
        .selectFrom("refresh_token_generations")
        .selectAll()
        .execute();
      expect(refreshGenerations).toHaveLength(1);
      expect(refreshGenerations[0]?.token_digest).toBe(digest(refreshToken));

      const securityEvents = await databaseClient.selectFrom("security_events").selectAll().execute();
      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0]?.event_type).toBe("passkey-added");
    });

    it("rejects a second completion for the same challenge", async () => {
      const enrollment = await insertEnrollmentAuthorization(databaseClient);
      const rawChallenge = randomBytes(32).toString("base64url");
      await repository.prepareRegistration({
        enrollmentTokenDigest: enrollment.tokenDigest,
        candidateUserHandle: randomBytes(32).toString("base64url"),
        rawChallenge,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
        maxOptionsRequests: 5,
        maxVerificationAttempts: 5,
      });

      const completeInput = {
        enrollmentTokenDigest: enrollment.tokenDigest,
        challengeDigest: digest(rawChallenge),
        now: createdAt,
        user: User.createForPasskeySignup({
          email: "person@example.com",
          webauthnUserHandle: randomBytes(32).toString("base64url"),
          emailVerifiedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        }),
        passkey: {
          credentialId: "credential-id",
          publicKey: new Uint8Array([1, 2, 3]),
          algorithm: -7,
          transports: ["internal"],
          signatureCounter: 0,
          aaguid: "00000000-0000-0000-0000-000000000000",
          backupEligible: true,
          backupState: false,
        },
        accessTokenDigest: digest("access-token"),
        refreshTokenDigest: digest("refresh-token"),
        accessInactivityExpiresAt: new Date("2026-07-31T12:30:00.000Z"),
        accessAbsoluteExpiresAt: new Date("2026-07-31T20:00:00.000Z"),
        familyInactivityExpiresAt: new Date("2026-08-07T12:00:00.000Z"),
        familyAbsoluteExpiresAt: new Date("2026-08-30T12:00:00.000Z"),
        securityEventId: randomUUID(),
      };

      await repository.completeRegistration(completeInput, "access-token", "refresh-token");

      await expect(
        repository.completeRegistration(
          {
            ...completeInput,
            user: User.createForPasskeySignup({
              email: "other@example.com",
              webauthnUserHandle: randomBytes(32).toString("base64url"),
              emailVerifiedAt: createdAt,
              createdAt,
              updatedAt: createdAt,
            }),
            securityEventId: randomUUID(),
          },
          "access-token-2",
          "refresh-token-2",
        ),
      ).rejects.toBeInstanceOf(EnrollmentAuthorizationRequiredError);
    });
  });
});
