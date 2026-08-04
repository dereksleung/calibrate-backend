import { describe, expect, it } from "vitest";

import { Route } from "./otp";

describe("/auth/otp route", () => {
  it("redirects a direct visit without valid handoff state", () => {
    expect(() =>
      Route.options.beforeLoad?.({
        location: {
          state: { __TSR_index: 0 },
        },
      } as never),
    ).toThrow();
  });

  it("accepts a visit with valid handoff state", () => {
    expect(() =>
      Route.options.beforeLoad?.({
        location: {
          state: {
            __TSR_index: 0,
            accountEmailVerification: {
              email: "person@example.com",
              challengeId: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
              expiresInSeconds: 600,
              resendAfterSeconds: 60,
              requestedAtEpochMs: 1_700_000_000_000,
            },
          },
        },
      } as never),
    ).not.toThrow();
  });
});
