import { createHmac, createSecretKey } from "node:crypto";

import { NodeEmailOtpCodeService } from "../node-email-otp-code-service.js";

describe("NodeEmailOtpCodeService", () => {
  it("creates a six-digit code and a challenge-bound HMAC digest", () => {
    const keyBytes = Buffer.alloc(32, 7);
    const key = createSecretKey(keyBytes);
    const service = new NodeEmailOtpCodeService({ key, keyVersion: 3 });

    const result = service.createChallenge("account-email-verification");
    const message = JSON.stringify([
      "calibrate-email-otp",
      2,
      "account-email-verification",
      result.challengeId,
      result.code,
    ]);

    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.codeDigest).toBe(createHmac("sha256", keyBytes).update(message).digest("base64url"));
    expect(result.hmacFormatVersion).toBe(2);
    expect(result.hmacKeyVersion).toBe(3);
  });

  it("rejects keys shorter than 32 bytes", () => {
    expect(
      () => new NodeEmailOtpCodeService({ key: createSecretKey(Buffer.alloc(31)), keyVersion: 1 }),
    ).toThrow("at least 32 bytes");
  });

  it("verifies the structured digest with the matching key version", () => {
    const oldKey = createSecretKey(Buffer.alloc(32, 3));
    const currentKey = createSecretKey(Buffer.alloc(32, 7));
    const service = new NodeEmailOtpCodeService({
      key: currentKey,
      keyVersion: 3,
      verificationKeys: new Map([[2, oldKey]]),
    });
    const challengeId = "d9428888-122b-4e2b-9c24-2dc8442eaa31";
    const code = "012345";
    const message = JSON.stringify([
      "calibrate-email-otp",
      2,
      "account-email-verification",
      challengeId,
      code,
    ]);
    const codeDigest = createHmac("sha256", oldKey).update(message).digest("base64url");

    expect(
      service.verifyChallenge({
        challengeId,
        code,
        codeDigest,
        purpose: "account-email-verification",
        hmacFormatVersion: 2,
        hmacKeyVersion: 2,
      }),
    ).toBe(true);
    expect(
      service.verifyChallenge({
        challengeId,
        code: "999999",
        codeDigest,
        purpose: "account-email-verification",
        hmacFormatVersion: 2,
        hmacKeyVersion: 2,
      }),
    ).toBe(false);
  });

  it("rejects legacy format-one authentication challenges", () => {
    const key = createSecretKey(Buffer.alloc(32, 7));
    const service = new NodeEmailOtpCodeService({ key, keyVersion: 1 });
    const challengeId = "d9428888-122b-4e2b-9c24-2dc8442eaa31";
    const code = "012345";
    const legacyMessage = JSON.stringify(["email-otp", 1, "authentication", challengeId, code]);
    const codeDigest = createHmac("sha256", key).update(legacyMessage).digest("base64url");

    expect(
      service.verifyChallenge({
        challengeId,
        code,
        codeDigest,
        purpose: "account-email-verification",
        hmacFormatVersion: 1,
        hmacKeyVersion: 1,
      }),
    ).toBe(false);
  });
});
