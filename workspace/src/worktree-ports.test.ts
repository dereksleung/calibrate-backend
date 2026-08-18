import { describe, expect, it } from "vitest";

import { resolveStickyPortPair } from "./worktree-ports.js";

describe("resolveStickyPortPair", () => {
  it("reuses the previous port pair when both ports are still free", async () => {
    const previous = await resolveStickyPortPair(undefined, 43_300);

    await expect(resolveStickyPortPair(previous, 43_300)).resolves.toEqual(previous);
  });
});
