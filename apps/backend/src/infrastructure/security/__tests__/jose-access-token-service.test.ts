import { AuthenticationError } from "@application/errors/authentication-error.js";
import * as dotenvx from "@dotenvx/dotenvx";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JoseAccessTokenService } from "../jose-access-token-service.js";

vi.mock("@dotenvx/dotenvx", async () => {
  const actual = await vi.importActual<typeof import("@dotenvx/dotenvx")>("@dotenvx/dotenvx");

  return {
    default: {
      ...actual,
      get: vi.fn(),
    },
  };
});

describe("JoseAccessTokenService", () => {
  const mockedGet = vi.mocked(dotenvx.default.get);

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString().trim();
  const escapedPrivateKeyPem = privateKeyPem.replace(/\n/g, "\\n");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T00:00:00.000Z"));
    mockedGet.mockReset();
    mockedGet.mockReturnValue(escapedPrivateKeyPem);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.JWT_PRIVATE_KEY_PEM;
  });

  it("should issue and verify tokens using dotenvx.get for the private key", async () => {
    process.env.JWT_PRIVATE_KEY_PEM = "do-not-use-process-env";

    const tokenService = new JoseAccessTokenService({
      issuer: "clean-architecture-backend",
      audience: "clean-architecture-client",
      expiresInSeconds: 900,
      envFilePath: "/tmp/test.env",
      envKeysFilePath: "/tmp/test.env.keys",
    });

    const issuedToken = await tokenService.issue({ userId: "user-1" });
    const verifiedToken = await tokenService.verify(issuedToken.token);

    expect(issuedToken.expiresInSeconds).toBe(900);
    expect(verifiedToken).toEqual({ userId: "user-1" });
    expect(mockedGet).toHaveBeenCalledWith(
      "JWT_PRIVATE_KEY_PEM",
      expect.objectContaining({
        path: "/tmp/test.env",
        envKeysFile: "/tmp/test.env.keys",
        strict: true,
      }),
    );
  });

  it("should reject expired tokens", async () => {
    const tokenService = new JoseAccessTokenService({
      issuer: "clean-architecture-backend",
      audience: "clean-architecture-client",
      expiresInSeconds: 60,
      publicKeyPem,
    });

    const issuedToken = await tokenService.issue({ userId: "user-1" });
    vi.advanceTimersByTime(61_000);

    await expect(tokenService.verify(issuedToken.token)).rejects.toThrow(AuthenticationError);
  });

  it("should reject tokens with the wrong audience", async () => {
    const signingService = new JoseAccessTokenService({
      issuer: "clean-architecture-backend",
      audience: "clean-architecture-client",
      expiresInSeconds: 900,
    });
    const verifyingService = new JoseAccessTokenService({
      issuer: "clean-architecture-backend",
      audience: "some-other-audience",
      expiresInSeconds: 900,
      publicKeyPem,
    });

    const issuedToken = await signingService.issue({ userId: "user-1" });

    await expect(verifyingService.verify(issuedToken.token)).rejects.toThrow(AuthenticationError);
  });

  it("should reject malformed tokens", async () => {
    const tokenService = new JoseAccessTokenService({
      issuer: "clean-architecture-backend",
      audience: "clean-architecture-client",
      expiresInSeconds: 900,
      publicKeyPem,
    });

    await expect(tokenService.verify("not-a-jwt")).rejects.toThrow(AuthenticationError);
  });
});
