import { defineConfig } from "vitest/config";

// Covers the Pulse derivation logic. That code turns real figures into
// recommendations, and a wrong reading there renders as a confident sentence
// with a confidence label attached, which is worse than showing nothing. Two
// such readings shipped before these tests existed.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
