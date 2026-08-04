import { describe, expect, it } from "vitest";

import {
  createAccountEmailVerificationHandoff,
  parseAccountEmailVerificationHandoff,
} from "./account-email-verification-handoff";

describe("signup email verification handoff", () => {
  it("creates normalized typed history state", () => {
    expect(
      createAccountEmailVerificationHandoff(
        " Person@Example.COM ",
        {
          challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        },
        1_700_000_000_000,
      ),
    ).toEqual({
      email: "person@example.com",
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
      requestedAtEpochMs: 1_700_000_000_000,
    });
  });

  it.each([
    undefined,
    {},
    {
      email: "person@example.com",
      challengeId: "not-a-uuid",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
      requestedAtEpochMs: 1_700_000_000_000,
    },
    {
      email: "person@example.com",
      challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
      requestedAtEpochMs: 1_700_000_000_000,
      unexpected: true,
    },
  ])("rejects invalid direct-navigation state", (value) => {
    expect(parseAccountEmailVerificationHandoff(value)).toBeNull();
  });
});
