import { IEmailOtpCodeService, type CreatedEmailOtpCode } from "@application";
import { createHmac, randomInt, randomUUID } from "node:crypto";

const HMAC_FORMAT_VERSION = 1;

export class NodeEmailOtpCodeService implements IEmailOtpCodeService {
  private readonly key: Buffer;
  private readonly keyVersion: number;

  constructor(config: { key: Buffer; keyVersion: number }) {
    if (config.key.byteLength < 32) {
      throw new Error("The email OTP HMAC key must contain at least 32 bytes");
    }
    if (!Number.isInteger(config.keyVersion) || config.keyVersion < 1) {
      throw new Error("The email OTP HMAC key version must be a positive integer");
    }
    this.key = config.key;
    this.keyVersion = config.keyVersion;
  }

  createChallenge(purpose: "authentication"): CreatedEmailOtpCode {
    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const message = JSON.stringify(["email-otp", HMAC_FORMAT_VERSION, purpose, challengeId, code]);

    return {
      challengeId,
      code,
      codeDigest: createHmac("sha256", this.key).update(message).digest("base64url"),
      hmacFormatVersion: HMAC_FORMAT_VERSION,
      hmacKeyVersion: this.keyVersion,
    };
  }
}
