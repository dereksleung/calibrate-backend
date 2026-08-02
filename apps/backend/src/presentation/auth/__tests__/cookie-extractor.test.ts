import { extractCookieValue } from "../cookie-extractor.js";

describe("extractCookieValue", () => {
  it("returns the value for an exact cookie name match", () => {
    expect(extractCookieValue("passkey-enrollment=abc123; other=value", "passkey-enrollment")).toBe("abc123");
  });

  it("decodes percent-encoded cookie values", () => {
    expect(extractCookieValue("calibrate-access=abc%2Fdef", "calibrate-access")).toBe("abc/def");
  });

  it("returns null when the cookie is missing or empty", () => {
    expect(extractCookieValue(undefined, "passkey-enrollment")).toBeNull();
    expect(extractCookieValue("other=value", "passkey-enrollment")).toBeNull();
    expect(extractCookieValue("passkey-enrollment=", "passkey-enrollment")).toBeNull();
  });
});
