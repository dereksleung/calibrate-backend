import { afterEach, describe, expect, it, vi } from "vitest";

const { dotenvGet } = vi.hoisted(() => ({ dotenvGet: vi.fn() }));

vi.mock("@dotenvx/dotenvx", () => ({
  default: {
    get: dotenvGet,
  },
}));

import { getRuntimeEnvironmentValue } from "../runtime-environment.js";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  dotenvGet.mockReset();
});

describe("getRuntimeEnvironmentValue", () => {
  it("uses the process environment without consulting dotenvx in E2E mode", () => {
    process.env.CALIBRATE_E2E = "1";
    process.env.WEBAUTHN_ORIGIN = "http://localhost:43100";
    dotenvGet.mockReturnValue("http://localhost:3000");

    expect(getRuntimeEnvironmentValue("WEBAUTHN_ORIGIN")).toBe("http://localhost:43100");
    expect(dotenvGet).not.toHaveBeenCalled();
  });

  it("fails closed when an E2E-controlled value is absent", () => {
    process.env.CALIBRATE_E2E = "1";
    delete process.env.OTP_HMAC_KEY;
    dotenvGet.mockReturnValue("dotenv-secret");

    expect(getRuntimeEnvironmentValue("OTP_HMAC_KEY")).toBeUndefined();
    expect(dotenvGet).not.toHaveBeenCalled();
  });

  it("uses dotenvx outside E2E mode", () => {
    delete process.env.CALIBRATE_E2E;
    dotenvGet.mockReturnValue("dotenv-value");

    expect(getRuntimeEnvironmentValue("WEBAUTHN_ORIGIN")).toBe("dotenv-value");
    expect(dotenvGet).toHaveBeenCalledWith("WEBAUTHN_ORIGIN");
  });
});
