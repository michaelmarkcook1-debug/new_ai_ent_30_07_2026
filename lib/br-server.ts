import { promises as fs } from "fs";
import path from "path";

// Server-side BoardRadar access, for server components that need real figures
// at render time rather than after a client round trip.
//
// Same discipline as the browser proxy at /api/br: the key stays server-side,
// a short timeout, and a recorded fixture as the fallback so a stage failure
// degrades to real-but-dated data rather than to a blank page. The source it
// reports says which happened, and the UI badges accordingly: a fixture read
// is never labelled live.

const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 300_000;

export type BrServerSource = "live" | "mock" | "error";

export interface BrServerResult<T> {
  data: T | null;
  source: BrServerSource;
}

type CacheEntry = { data: unknown; source: BrServerSource; at: number };
const cache = new Map<string, CacheEntry>();

// Fixture naming mirrors the proxy's: path separators become underscores and
// the ticker is appended, e.g. ai-exposure?ticker=MSFT -> ai-exposure_MSFT.
async function readFixture<T>(
  endpoint: string,
  ticker?: string
): Promise<T | null> {
  const base = endpoint.replace(/\//g, "_");
  const name = ticker ? `${base}_${ticker}` : base;
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "fixtures", "br", `${name}.json`),
      "utf8"
    );
    return JSON.parse(file) as T;
  } catch {
    return null;
  }
}

export async function brServerFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<BrServerResult<T>> {
  const qs = params ? new URLSearchParams(params).toString() : "";
  const key = `${endpoint}?${qs}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { data: hit.data as T, source: hit.source };
  }

  const base = process.env.ANALYSTGENIUS_API_BASE;
  const apiKey = process.env.ANALYSTGENIUS_API_KEY;

  if (base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${base}/${endpoint}${qs ? `?${qs}` : ""}`, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "X-API-Key": apiKey ?? "",
        },
        cache: "no-store",
      });
      clearTimeout(timer);

      // Only a JSON answer counts as data. A non-JSON response means the API
      // served an error page for a path it does not recognise, which is a
      // routing failure rather than a live result.
      const isJson = (res.headers.get("content-type") ?? "").includes("json");
      if (res.ok && isJson) {
        const data = (await res.json()) as T;
        cache.set(key, { data, source: "live", at: Date.now() });
        return { data, source: "live" };
      }
    } catch {
      // Fall through to the recorded response.
    }
  }

  const fixture = await readFixture<T>(endpoint, params?.ticker);
  if (fixture) {
    cache.set(key, { data: fixture, source: "mock", at: Date.now() });
    return { data: fixture, source: "mock" };
  }
  return { data: null, source: "error" };
}
