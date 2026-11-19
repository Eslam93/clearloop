import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: the server's services against a real Postgres, through the app role.
// Reuses the db package's setup: a fresh migrated database per run (embedded locally, the
// Postgres service container in CI).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.int.test.ts"],
    environment: "node",
    globalSetup: ["../../packages/db/tests/global-setup.ts"],
    setupFiles: ["../../packages/db/tests/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    teardownTimeout: 2_000,
  },
});
