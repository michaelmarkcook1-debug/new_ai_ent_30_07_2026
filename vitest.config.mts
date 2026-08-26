import { defineConfig } from "vitest/config";

// Covers the Pulse derivation logic. That code turns real figures into
// recommendations, and a wrong reading there renders as a confident sentence
// with a confidence label attached, which is worse than showing nothing. Two
// such readings shipped before these tests existed.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // The app's tsconfig sets jsx: "preserve", which is what Next wants and what
  // leaves vite unable to parse a .tsx component. Setting the transform here
  // rather than in tsconfig keeps the build untouched: this file is read by
  // vitest and by nothing else. Needed so tests can render the analyst panel
  // and read its markup, which is the only way to assert what a reader sees
  // without standing up the demo shell and its basic auth.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
