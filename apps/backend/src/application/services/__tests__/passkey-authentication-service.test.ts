import type { IPasskeyAuthenticationRepository } from "@application/ports/passkey-authentication-repository.js";
import type { IWebAuthnAuthenticationPort } from "@application/ports/webauthn-authentication-port.js";

import { OriginNotAllowedError } from "@application/errors/passkey-registration-errors.js";

import { PasskeyAuthenticationServiceImpl } from "../passkey-authentication-service.js";

const now = new Date("2026-08-01T12:00:00.000Z");
const expectedOrigin = "http://localhost:3000";

function createService(
  overrides: {
    repository?: Partial<IPasskeyAuthenticationRepository>;
    webAuthn?: Partial<IWebAuthnAuthenticationPort>;
  } = {},
) {
  const repository: IPasskeyAuthenticationRepository = {
    prepareAuthentication: vi.fn(),
    consumeVerificationRateLimit: vi.fn(),
    ...overrides.repository,
  };
  const webAuthn: IWebAuthnAuthenticationPort = {
    createAuthenticationOptions: vi.fn(),
    verifyAuthenticationResponse: vi.fn(),
    ...overrides.webAuthn,
  };

  return {
    service: new PasskeyAuthenticationServiceImpl(
      repository,
      webAuthn,
      { now: () => now },
      { expectedOrigin },
    ),
    repository,
    webAuthn,
  };
}

describe("PasskeyAuthenticationServiceImpl", () => {
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
    expect(result.options.timeout).toBe(300_000);
  });
});
