import { promises as fs } from "fs";
import path from "path";

// Server-side access to the deployed AI Enterprise public APIs, for server
// components that need real figures at render time rather than after a
// client round trip.
//
// Same discipline as the browser proxy at /api/aie: GET only, whitelist,
// timeout, in-process cache, and a recorded fixture as the fallback so a
// stage failure degrades to real-but-dated data rather than to an invented
// number or a blank page. The lane it returns says which of those happened,
// and the UI badges accordingly: never claim "live" for a fixture read.

const AIE_BASE = "https://ranking-engine-red.vercel.app/api";
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 300_000;

export type AieEndpoint =
  | "vendors"
  | "market-share"
  | "market-dashboard"
  | "reputation"
  | "capabilities"
  | "uptake"
  | "pricing"
  | "model-inventory"
  | "metadata"
  | "news";

// "aie-live" means this render pulled from the upstream API.
// "aie" means the upstream did not answer and the recorded payload was used.
export type AieLane = "aie-live" | "aie";

export interface AieServerResult<T> {
  data: T | null;
  lane: AieLane;
  /** Present when the fixture was used: when that payload was recorded. */
  recordedAt?: string;
}

type CacheEntry = { data: unknown; lane: AieLane; at: number };
const cache = new Map<string, CacheEntry>();

async function readFixture<T>(endpoint: AieEndpoint): Promise<T | null> {
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "fixtures", "aie-live", `${endpoint}.json`),
      "utf8"
    );
    return JSON.parse(file) as T;
  } catch {
    return null;
  }
}

export async function aieServerFetch<T>(
  endpoint: AieEndpoint
): Promise<AieServerResult<T>> {
  const hit = cache.get(endpoint);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { data: hit.data as T, lane: hit.lane };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${AIE_BASE}/${endpoint}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as T;
      cache.set(endpoint, { data, lane: "aie-live", at: Date.now() });
      return { data, lane: "aie-live" };
    }
  } catch {
    // Fall through to the recorded payload.
  }

  const fixture = await readFixture<T>(endpoint);
  if (fixture) {
    cache.set(endpoint, { data: fixture, lane: "aie", at: Date.now() });
  }
  return { data: fixture, lane: "aie" };
}
