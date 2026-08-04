import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next traces the files a route needs by reading the code. Every fixture
  // read in this app builds its path from a variable — `disclosure-${form}`,
  // `${apiPath}.json` — which static analysis cannot resolve, so none of them
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
