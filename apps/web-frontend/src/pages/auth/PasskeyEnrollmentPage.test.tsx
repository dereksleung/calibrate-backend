// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@calibrate/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "#/shared/api/query-client.ts";
import { authenticatedSessionQueryKey } from "#/verticals/auth/authenticated-session.ts";
import type { BrowserPasskeyRegistrationAdapter } from "#/verticals/auth/browser-passkey-registration-adapter.ts";
import { PasskeyEnrollmentPage } from "./PasskeyEnrollmentPage.tsx";

const mockRequestOptions = vi.fn();
const mockVerifyRegistration = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@calibrate/api-client", async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return {
    ...original,
    requestPasskeyRegistrationOptions: (...args: unknown[]) => mockRequestOptions(...args),
    verifyPasskeyRegistration: (...args: unknown[]) => mockVerifyRegistration(...args),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

const handoff = {
  email: "person@example.com",
  next: "passkey-registration" as const,
  expiresAt: "2030-01-01T00:05:00.000Z",
};

const browserAdapter: BrowserPasskeyRegistrationAdapter = {
  createPasskey: vi.fn(),
};

function renderPage() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <PasskeyEnrollmentPage handoff={handoff} browserRegistration={browserAdapter} />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("PublicKeyCredential", {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    signalUnknownCredential: vi.fn(),
  });
});

describe("PasskeyEnrollmentPage", () => {
  it("runs options, browser ceremony, and verification exactly once on success", async () => {
    mockRequestOptions.mockResolvedValue({ challenge: "abc" });
    vi.mocked(browserAdapter.createPasskey).mockResolvedValue({
      id: "credential-id",
      rawId: "credential-id",
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
        attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
      },
    });
    mockVerifyRegistration.mockResolvedValue({
      user: {
        id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        email: "person@example.com",
        tier: "FREE",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      sessionTransport: "cookie",
    });

    const queryClient = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /create passkey/i }));

    await waitFor(() => {
      expect(mockRequestOptions).toHaveBeenCalledOnce();
      expect(browserAdapter.createPasskey).toHaveBeenCalledOnce();
      expect(mockVerifyRegistration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rememberDevice: true }),
      );
    });
    expect(queryClient.getQueryData(authenticatedSessionQueryKey)).toMatchObject({
      sessionTransport: "cookie",
      user: { email: "person@example.com" },
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("starts a fresh ceremony when Try again is clicked after cancellation", async () => {
    mockRequestOptions.mockResolvedValue({ challenge: "abc" });
    vi.mocked(browserAdapter.createPasskey)
      .mockRejectedValueOnce(Object.assign(new Error("cancelled"), { name: "NotAllowedError" }))
      .mockResolvedValueOnce({
        id: "credential-id",
        rawId: "credential-id",
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
        },
      });
    mockVerifyRegistration.mockResolvedValue({
      user: {
        id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
        email: "person@example.com",
        tier: "FREE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      sessionTransport: "cookie",
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /create passkey/i }));
    await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockRequestOptions).toHaveBeenCalledTimes(2);
    });
    expect(mockVerifyRegistration).toHaveBeenCalledOnce();
  });

  it("directs the user back to email verification when the enrollment can no longer start ceremonies", async () => {
    mockRequestOptions.mockRejectedValue(
      new ApiError({
        status: 401,
        statusText: "Unauthorized",
        body: { error: "ENROLLMENT_AUTHORIZATION_REQUIRED" },
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /create passkey/i }));

    expect(
      await screen.findByText(/enrollment authorization expired or can no longer be used/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /start again/i })).toBeTruthy();
  });

  it("signals a credential that could not be saved after device verification", async () => {
    mockRequestOptions.mockResolvedValue({
      challenge: "abc",
      rp: { id: "example.com", name: "Calibrate" },
    });
    vi.mocked(browserAdapter.createPasskey).mockResolvedValue({
      id: "credential-id",
      rawId: "credential-id",
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
        attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
      },
    });
    mockVerifyRegistration.mockRejectedValue(
      new ApiError({
        status: 400,
        statusText: "Bad Request",
        body: { error: "PASSKEY_REGISTRATION_FAILED" },
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /create passkey/i }));

    expect(await screen.findByText(/passkey verification failed/i)).toBeTruthy();
    expect(PublicKeyCredential.signalUnknownCredential).toHaveBeenCalledWith({
      credentialId: "credential-id",
      rpId: "example.com",
    });
  });
});
