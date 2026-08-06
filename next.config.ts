import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project.
  //
  // Next infers the root by walking up for a lockfile, and there is a stray
  // package-lock.json in the home directory left over from something else.
  // That made it choose /Users/michaelcook, so every traced path was resolved
  // against the wrong base and the build warned about it on every run.
  //
  // The adoption snapshot still shipped, but only because the include globs
  // below happened to survive the wrong root, which is luck, not design, and
  // the failure it was risking is the silent kind: a missing fixture reads as
  // an empty data state rather than an error.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // Next traces the files a route needs by reading the code. Every fixture
  // read in this app builds its path from a variable: `disclosure-${form}`,
  // `${apiPath}.json`, which static analysis cannot resolve, so none of them
  // would be bundled into the deployed function. The failure is invisible by
  // design: each read is wrapped in a catch that returns null, so a missing
  // file degrades to a clean "no data" state that looks like a data gap
  // rather than a deploy bug. These directories are included explicitly.
  outputFileTracingIncludes: {
    "/api/adoption/**": ["./data/adoption/**"],
    "/api/aie/**": ["./fixtures/aie-live/**"],
    "/api/br/**": ["./fixtures/br/**"],
  },
};

export default nextConfig;
