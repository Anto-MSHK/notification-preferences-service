import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
