import { describe, expect, it } from "vitest";

import { deriveDevBindings } from "./derive-dev-bindings.js";

describe("deriveDevBindings", () => {
  it("derives frontend and backend URLs from the port pair", () => {
    const bindings = deriveDevBindings({ frontend: 3010, backend: 3011 });

    expect(bindings).toEqual({
      ports: { frontend: 3010, backend: 3011 },
      frontendUrl: "http://localhost:3010",
      backendUrl: "http://localhost:3011",
      viteApiBaseUrl: "http://localhost:3011/api/v1",
      corsOrigin: "http://localhost:3010",
      webauthnOrigin: "http://localhost:3010",
    });
  });
});
