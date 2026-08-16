import { describe, expect, it } from "vitest";

import { isLocalDevelopmentRequest } from "./local-development-auth.js";

describe("isLocalDevelopmentRequest", () => {
  it("accepts a matching loopback origin and loopback client", () => {
    expect(
      isLocalDevelopmentRequest({
        environment: "development",
        origin: "http://localhost:3000",
        expectedOrigin: "http://localhost:3000",
        clientIp: "127.0.0.1",
      }),
    ).toBe(true);
  });

  it("rejects production even when the request looks local", () => {
    expect(
      isLocalDevelopmentRequest({
        environment: "production",
        origin: "http://localhost:3000",
        expectedOrigin: "http://localhost:3000",
        clientIp: "127.0.0.1",
      }),
    ).toBe(false);
  });

  it.each([
    { origin: "http://localhost:3000", expectedOrigin: "http://localhost:3001", clientIp: "127.0.0.1" },
    { origin: "https://localhost:3000", expectedOrigin: "https://localhost:3000", clientIp: "127.0.0.1" },
    { origin: "http://localhost:3000", expectedOrigin: "http://localhost:3000", clientIp: "192.168.1.20" },
    { origin: "http://example.test", expectedOrigin: "http://example.test", clientIp: "127.0.0.1" },
    { origin: undefined, expectedOrigin: "http://localhost:3000", clientIp: "127.0.0.1" },
    { origin: "null", expectedOrigin: "http://localhost:3000", clientIp: "127.0.0.1" },
    { origin: "http://localhost:3000/path", expectedOrigin: "http://localhost:3000", clientIp: "127.0.0.1" },
  ])("rejects unsafe request %#", (request) => {
    expect(isLocalDevelopmentRequest({ environment: "development", ...request })).toBe(false);
  });

  it.each([
    { origin: "http://localhost:3000", expectedOrigin: "http://localhost:3000", clientIp: "::1" },
    {
      origin: "http://localhost:3000",
      expectedOrigin: "http://localhost:3000",
      clientIp: "::ffff:127.0.0.1",
    },
  ])("accepts the supported loopback peer %#", (request) => {
    expect(isLocalDevelopmentRequest({ environment: "test", ...request })).toBe(true);
  });
});
