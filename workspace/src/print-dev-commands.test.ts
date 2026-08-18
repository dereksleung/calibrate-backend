import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  formatBackendDevCommand,
  formatWebDevCommand,
  shellQuote,
} from "./print-dev-commands.js";

describe("print dev commands", () => {
  it("prints nx commands with the derived env overrides", () => {
    const bindings = {
      ports: { frontend: 3010, backend: 3011 },
      frontendUrl: "http://localhost:3010",
      backendUrl: "http://localhost:3011",
      viteApiBaseUrl: "http://localhost:3011/api/v1",
      corsOrigin: "http://localhost:3010",
      webauthnOrigin: "http://localhost:3010",
    };

    expect(formatBackendDevCommand(bindings, "calibrate_wt_feature_ab12cd34")).toContain(
      "DB_NAME='calibrate_wt_feature_ab12cd34'",
    );
    expect(formatBackendDevCommand(bindings, "calibrate_wt_feature_ab12cd34")).toContain("PORT='3011'");
    expect(formatBackendDevCommand(bindings, "calibrate_wt_feature_ab12cd34")).toContain(
      "--env CALIBRATE_E2E=",
    );
    expect(formatWebDevCommand(bindings)).toContain("VITE_API_BASE_URL='http://localhost:3011/api/v1'");
    expect(formatWebDevCommand(bindings)).toContain("--env CALIBRATE_E2E=");
    expect(formatWebDevCommand(bindings)).toContain("--port '3010'");
  });

  it("keeps shell metacharacters inside one generated argument", () => {
    const value = "calibrate; printf injected 'quoted'";
    const output = execFileSync("sh", ["-c", `printf '%s' ${shellQuote(value)}`], {
      encoding: "utf8",
    });

    expect(output).toBe(value);
  });
});
