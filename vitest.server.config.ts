import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Server tests run in Node. Only TEST_* variables are loaded from .env files, so a
// test run can never pick up the production Redis credentials.
export default defineConfig(({ mode }) => ({
  test: {
    include: ["server/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), "TEST_"),
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
}));
