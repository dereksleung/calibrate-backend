import { NodeSessionTokenService } from "../node-session-token-service.js";

describe("NodeSessionTokenService", () => {
  it("creates an opaque token with at least 256 random bits and a separate digest", () => {
    const service = new NodeSessionTokenService();

    const first = service.create();
    const second = service.create();

    expect(Buffer.from(first.token, "base64url")).toHaveLength(32);
    expect(first.digest).not.toBe(first.token);
    expect(second.token).not.toBe(first.token);
    expect(second.digest).not.toBe(first.digest);
  });
});
