import { describe, expect, it, vi } from "vitest";

import { RecoveryPasskeyRegistrationServiceImpl } from "../recovery-passkey-registration-service.js";

describe("RecoveryPasskeyRegistrationServiceImpl", () => {
  it("uses the account's stable handle and excludes every active credential", async () => {
    const repository = {
      prepareRegistration: vi.fn().mockResolvedValue({
        userHandle: "stable-user-handle",
        email: "person@example.com",
        rawChallenge: "challenge",
        excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
      }),
    };
    const webAuthn = { createRegistrationOptions: vi.fn().mockResolvedValue({ challenge: "challenge" }) };
    const service = new RecoveryPasskeyRegistrationServiceImpl(repository, webAuthn, { now: () => new Date() }, { expectedOrigin: "http://localhost:3000" });

    await service.createRegistrationOptions("recovery-registration-token", "http://localhost:3000");

    expect(webAuthn.createRegistrationOptions).toHaveBeenCalledWith({
      userHandle: "stable-user-handle",
      email: "person@example.com",
      rawChallenge: "challenge",
      excludeCredentials: [{ id: "existing-credential", transports: ["internal"] }],
    });
  });
});
