import { IEmailOtpCodeService, type CreatedEmailOtpCode, type VerifyEmailOtpCodeProps } from "@application";
import { createHmac, KeyObject, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

const HMAC_FORMAT_VERSION = 1;

export class NodeEmailOtpCodeService implements IEmailOtpCodeService {
  private readonly key: KeyObject;
  private readonly keyVersion: number;
  private readonly verificationKeys: ReadonlyMap<number, KeyObject>;

  constructor(config: {
    key: KeyObject;
    keyVersion: number;
    verificationKeys?: ReadonlyMap<number, KeyObject>;
  }) {
    this.assertValidKey(config.key);
    if (!Number.isInteger(config.keyVersion) || config.keyVersion < 1) {
      throw new Error("The email OTP HMAC key version must be a positive integer");
    }
    this.key = config.key;
    this.keyVersion = config.keyVersion;
    for (const key of config.verificationKeys?.values() ?? []) this.assertValidKey(key);
    this.verificationKeys = new Map([
      ...(config.verificationKeys?.entries() ?? []),
      [config.keyVersion, config.key] as const,
    ]);
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

  verifyChallenge(props: VerifyEmailOtpCodeProps): boolean {
    if (props.hmacFormatVersion !== HMAC_FORMAT_VERSION) return false;
    const key = this.verificationKeys.get(props.hmacKeyVersion);
    if (!key) return false;

    const message = JSON.stringify([
      "email-otp",
      props.hmacFormatVersion,
      props.purpose,
      props.challengeId,
      props.code,
    ]);
    const calculated = createHmac("sha256", key).update(message).digest();
    const stored = Buffer.from(props.codeDigest, "base64url");
    const comparable =
      stored.byteLength === calculated.byteLength ? stored : Buffer.alloc(calculated.byteLength);

    return timingSafeEqual(calculated, comparable) && stored.byteLength === calculated.byteLength;
  }

  private assertValidKey(key: KeyObject): void {
    if (key.type !== "secret" || (key.symmetricKeySize ?? 0) < 32) {
      throw new Error("The email OTP HMAC key must contain at least 32 bytes");
    }
  }
}
