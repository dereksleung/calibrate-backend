import { getRecoveryRegistrationCookieConfiguration } from "../recovery-registration-cookie.js";

describe("recovery-registration cookie", () => {
  it("is HttpOnly, strict, and limited to recovery registration", () => {
    const cookie = getRecoveryRegistrationCookieConfiguration();

    expect(cookie).toEqual({
      name: "recovery-registration",
      options: expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        path: "/api/v1/auth/recovery/passkeys/registration",
        maxAge: 15 * 60 * 1000,
      }),
    });
  });
});
