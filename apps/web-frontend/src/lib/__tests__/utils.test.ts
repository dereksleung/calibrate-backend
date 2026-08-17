import { describe, expect, it } from "vitest";

import { cn } from "../utils";

describe("cn", () => {
  it("combines conditional class values", () => {
    const isHidden = false;
    const result = cn("base", ["nested", isHidden && "hidden"], {
      selected: true,
      disabled: false,
    });

    expect(result).toBe("base nested selected");
  });

  it("lets later Tailwind utility classes override earlier conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
