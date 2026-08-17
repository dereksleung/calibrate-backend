import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
  test: {
    include: [
      "src/**/*.integration.test.{ts,tsx}",
      "integration/**/*.test.{ts,tsx}",
      "test/integration/**/*.test.{ts,tsx}",
    ],
    exclude: [...configDefaults.exclude, "dist/**"],
    globals: true,
    environment: "node",
  },
});
