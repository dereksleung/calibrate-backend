import { BrevoEmailSender } from "../brevo-email-sender.js";

describe("BrevoEmailSender", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends neutral account-email copy with a challenge-scoped idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "delivery-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await new BrevoEmailSender("test-api-key").sendAccountEmailVerificationCode({
      email: "person@example.com",
      code: "012345",
      expiresInMinutes: 10,
      deliveryId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(
      expect.objectContaining({
        "api-key": "test-api-key",
      }),
    );

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      to: [{ email: "person@example.com" }],
      subject: "Verify your Calibrate recovery email",
      params: { code: "012345" },
      headers: {
        idempotencyKey: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      },
    });
    expect(body.htmlContent).toContain("verify your email and continue to your Calibrate account");
    expect(body.htmlContent).not.toMatch(/log[ -]?in/i);
  });
});
