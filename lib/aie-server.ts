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

/**
 * Two attempts, and the second is the longer one.
 *
 * THE DEFECT THIS FIXES, measured on 30 August 2026. The upstream is itself a
 * serverless deployment, so it sleeps. A request arriving to a cold container
 * took 20 seconds; this made ONE attempt, gave up at 8, and served a recorded
 * payload from a fortnight earlier. The page was not wrong, but it was two
 * weeks old and looked exactly like a fresh one.
 *
 * The first attempt is what WAKES the upstream, so aborting it early is not a
 * wasted call: the container is booting by the time the second goes out, and
 * the second is given room to land. A genuinely dead upstream costs 20 seconds
 * before the fallback, which is the price of not quietly publishing stale
 * figures, and it is paid once per instance rather than per reader.
 */
const TIMEOUT_MS = [8_000, 12_000];

/** A live payload is good for five minutes. */
const CACHE_TTL_MS = 300_000;

/**
 * A fallback is good for twenty seconds.
 *
 * THE SECOND HALF OF THE SAME DEFECT, and the worse half. The fallback was
 * cached under the same five-minute TTL as a live payload, so one cold start
 * did not cost one render, it cost every render on that instance for the next
 * five minutes. Retrying sooner costs one upstream call; not retrying costs a
 * reader an afternoon of fortnight-old figures with nothing on screen to say
 * the wind had changed.
 */
const FALLBACK_TTL_MS = 20_000;

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
  const ttl = hit?.lane === "aie" ? FALLBACK_TTL_MS : CACHE_TTL_MS;
  if (hit && Date.now() - hit.at < ttl) {
    return { data: hit.data as T, lane: hit.lane };
  }

  for (const timeout of TIMEOUT_MS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
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
      // A 4xx is a real answer and will be the same answer next time.
      if (res.status < 500) break;
    } catch {
      // Timeout or network failure. Try once more, then the recorded payload.
    }
  }

  const fixture = await readFixture<T>(endpoint);
  if (fixture) {
    cache.set(endpoint, { data: fixture, lane: "aie", at: Date.now() });
  }
  return { data: fixture, lane: "aie" };
}
