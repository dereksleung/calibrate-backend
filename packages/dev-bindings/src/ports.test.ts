import { describe, expect, it } from "vitest";

import { canBindLocalhost, selectPortPair } from "./ports.js";

describe("selectPortPair", () => {
  it("selects an adjacent even frontend port and the next backend port", async () => {
    const ports = await selectPortPair(43_200);

    expect(ports.frontend).toBeGreaterThanOrEqual(43_200);
    expect(ports.frontend % 2).toBe(0);
    expect(ports.backend).toBe(ports.frontend + 1);
    expect(await canBindLocalhost(ports.frontend)).toBe(true);
    expect(await canBindLocalhost(ports.backend)).toBe(true);
  });
});
