// @vitest-environment jsdom

import { createQueryClient } from "#/shared/api/query-client.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionRestorationGate } from "./session-restoration-gate.tsx";

const { mockGetCurrentSession, mockRefreshSession, mockRestoreDayLogCache, mockNavigate } = vi.hoisted(
  () => ({
    mockGetCurrentSession: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockRestoreDayLogCache: vi.fn(),
    mockNavigate: vi.fn(),
  }),
);

vi.mock("@calibrate/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@calibrate/api-client")>()),
  getCurrentSession: mockGetCurrentSession,
  refreshSession: mockRefreshSession,
}));

vi.mock("#/shared/api/day-log-cache.ts", () => ({
  restoreDayLogCache: mockRestoreDayLogCache,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mockNavigate,
}));

const authenticatedSession = {
  user: {
    id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
    email: "person@example.com",
    tier: "FREE" as const,
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: new Date("2030-01-01T00:00:00.000Z"),
  },
  sessionTransport: "cookie" as const,
};

beforeEach(() => {
  mockGetCurrentSession.mockResolvedValue(authenticatedSession);
  mockRefreshSession.mockResolvedValue(authenticatedSession);
  mockRestoreDayLogCache.mockResolvedValue(undefined);
  mockNavigate.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionRestorationGate", () => {
  it("waits for the confirmed user's Day Log cache restoration before mounting reads", async () => {
    let releaseRestore!: () => void;
    mockRestoreDayLogCache.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseRestore = resolve;
        }),
    );
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SessionRestorationGate>
          <p>Dashboard reads</p>
        </SessionRestorationGate>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockGetCurrentSession).toHaveBeenCalledTimes(1));
    expect(mockRestoreDayLogCache).toHaveBeenCalledWith(
      queryClient,
      authenticatedSession.user.id,
      expect.objectContaining({ isCurrentUser: expect.any(Function) }),
    );
    expect(screen.queryByText("Dashboard reads")).toBeNull();

    releaseRestore();

    expect(await screen.findByText("Dashboard reads")).toBeTruthy();
  });

  it("starts cache restoration only after the server identifies the current account", async () => {
    const events: string[] = [];
    mockGetCurrentSession.mockImplementation(async () => {
      events.push("session-confirmed");
      return authenticatedSession;
    });
    mockRestoreDayLogCache.mockImplementation(async () => {
      events.push("cache-restored");
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <SessionRestorationGate>
          <p>Dashboard reads</p>
        </SessionRestorationGate>
      </QueryClientProvider>,
    );

    await screen.findByText("Dashboard reads");

    expect(events).toEqual(["session-confirmed", "cache-restored"]);
  });
});
