import { createHmac } from "node:crypto";

import { NodeEmailOtpCodeService } from "../node-email-otp-code-service.js";

describe("NodeEmailOtpCodeService", () => {
  it("creates a six-digit code and a challenge-bound HMAC digest", () => {
    const key = Buffer.alloc(32, 7);
    const service = new NodeEmailOtpCodeService({ key, keyVersion: 3 });

    const result = service.createChallenge("authentication");
    const message = JSON.stringify(["email-otp", 1, "authentication", result.challengeId, result.code]);

    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.codeDigest).toBe(createHmac("sha256", key).update(message).digest("base64url"));
    expect(result.hmacFormatVersion).toBe(1);
    expect(result.hmacKeyVersion).toBe(3);
  });

  it("rejects keys shorter than 32 bytes", () => {
    expect(() => new NodeEmailOtpCodeService({ key: Buffer.alloc(31), keyVersion: 1 })).toThrow(
      "at least 32 bytes",
    );
  });
});
