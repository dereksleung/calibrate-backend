import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessTokenService, IssuedAccessToken } from "@application/ports/access-token-service.js";
import dotenvx from "@dotenvx/dotenvx";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import path from "node:path";

import { getRuntimeEnvironmentValue, isE2eRuntime } from "../runtime-environment.js";

interface JoseAccessTokenServiceConfig {
  issuer: string;
  audience: string;
  expiresInSeconds: number;
  keyId?: string;
  envFilePath?: string;
  envKeysFilePath?: string;
  publicKeyPem?: string;
}

export class JoseAccessTokenService implements IAccessTokenService {
  private readonly config: JoseAccessTokenServiceConfig;
  private signingKeyPromise?: Promise<JwtKey>;
  private verificationKeyPromise?: Promise<JwtKey>;
  private privateKeyPem?: string;

  constructor(config?: Partial<JoseAccessTokenServiceConfig>) {
    this.config = JoseAccessTokenService.resolveConfig(config);
  }

  async issue({ userId }: { userId: string }): Promise<IssuedAccessToken> {
    // "EdDSA" has been in the JOSE ecosystem since RFC 8037 (2017).
    // Every JWT library in every language recognizes it.
    // The newer "Ed25519" identifier (RFC 9864, late 2024) is still gaining adoption;
    // some consuming services or older libraries may not accept it yet.
    const protectedHeader = this.config.keyId
      ? { alg: "EdDSA" as const, kid: this.config.keyId }
      : { alg: "EdDSA" as const };

    const token = await new SignJWT({})
      .setProtectedHeader(protectedHeader)
      .setSubject(userId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.expiresInSeconds}s`)
      .sign(await this.getSigningKey());

    return {
      token,
      expiresInSeconds: this.config.expiresInSeconds,
    };
  }

  async verify(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, await this.getVerificationKey(), {
        algorithms: ["EdDSA"],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (!payload.sub) {
        throw new AuthenticationError("Invalid token payload");
      }

      return {
        userId: payload.sub,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError("Invalid or expired token");
    }
  }

  private static resolveConfig(config?: Partial<JoseAccessTokenServiceConfig>): JoseAccessTokenServiceConfig {
    const expiresIn =
      config?.expiresInSeconds ??
      parseExpiresInSeconds(getRuntimeEnvironmentValue("JWT_ACCESS_TOKEN_TTL_SECONDS"));
    const issuer = config?.issuer ?? getRuntimeEnvironmentValue("JWT_ISSUER");
    const audience = config?.audience ?? getRuntimeEnvironmentValue("JWT_AUDIENCE");

    if (!issuer) {
      throw new Error("JWT_ISSUER is not configured");
    }
    if (!audience) {
      throw new Error("JWT_AUDIENCE is not configured");
    }
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error("JWT_ACCESS_TOKEN_TTL_SECONDS must be a positive integer");
    }

    return {
      issuer,
      audience,
      expiresInSeconds: expiresIn,
      keyId: config?.keyId ?? getRuntimeEnvironmentValue("JWT_KEY_ID"),
      envFilePath: config?.envFilePath ?? path.resolve(process.cwd(), ".env"),
      envKeysFilePath: config?.envKeysFilePath ?? path.resolve(process.cwd(), ".env.keys"),
      publicKeyPem: config?.publicKeyPem, // optional; if not provided, will be derived from the private key
    };
  }

  private async getSigningKey(): Promise<JwtKey> {
    if (!this.signingKeyPromise) {
      this.signingKeyPromise = importPKCS8(this.getPrivateKeyPem(), "EdDSA");
    }

    return this.signingKeyPromise;
  }

  private async getVerificationKey(): Promise<JwtKey> {
    if (!this.verificationKeyPromise) {
      const publicKeyPem = this.config.publicKeyPem
        ? normalizePem(this.config.publicKeyPem)
        : this.derivePublicKeyPem(this.getPrivateKeyPem());

      this.verificationKeyPromise = importSPKI(publicKeyPem, "EdDSA");
    }

    return this.verificationKeyPromise;
  }

  private getPrivateKeyPem(): string {
    if (!this.privateKeyPem) {
      const getOptions = {
        path: this.config.envFilePath ?? path.resolve(process.cwd(), ".env"),
        envKeysFile: this.config.envKeysFilePath ?? path.resolve(process.cwd(), ".env.keys"),
        strict: true,
      } as Parameters<typeof dotenvx.get>[1];
      const privateKeyPem = isE2eRuntime()
        ? process.env.JWT_PRIVATE_KEY_PEM
        : dotenvx.get("JWT_PRIVATE_KEY_PEM", getOptions);

      if (!privateKeyPem) {
        throw new Error("JWT_PRIVATE_KEY_PEM is not configured");
      }

      this.privateKeyPem = normalizePem(privateKeyPem);
    }

    return this.privateKeyPem;
  }

  private derivePublicKeyPem(privateKeyPem: string): string {
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(privateKey);
    return exportPem(publicKey);
  }
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function exportPem(key: KeyObject): string {
  return key.export({ type: "spki", format: "pem" }).toString().trim();
}

function parseExpiresInSeconds(value?: string): number {
  if (!value) {
    return Number.NaN;
  }

  return Number.parseInt(value, 10);
}

type JwtKey = Awaited<ReturnType<typeof importPKCS8>>;
