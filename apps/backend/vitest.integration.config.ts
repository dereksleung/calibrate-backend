import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.integration.test.ts", "integration/**/*.test.ts", "test/integration/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "dist/**"],
    fileParallelism: false,
    globalSetup: ["./test/integration/global-setup.ts"],
    globals: true,
    environment: "node",
  },
});
