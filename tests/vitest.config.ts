import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["unit/**/*.test.ts", "integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@loopin/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@loopin/backend": path.resolve(__dirname, "../backend/src"),
    },
  },
});
