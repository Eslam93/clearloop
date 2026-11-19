import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // One database per run; files share it, so they run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // On Windows the embedded Postgres leaves stdio file handles open for a moment after it
    // stops, and Vitest would wait 10s for them. CI uses a Postgres container and is unaffected.
    teardownTimeout: 2_000,
  },
});
