import { promises as fs } from "node:fs";
import path from "node:path";
import type { NewsItemRaw } from "./insight";

// Where the Analyst Insight gets its dated item, and how often it changes.
//
// Every insight page used to do `import newsFixture from
// "@/fixtures/aie-live/news.json"`. A static import is resolved at build time
// and baked into the bundle, and the deployed filesystem is immutable, so the
// "Latest development" on nine tabs was frozen at whatever the news said on
// the day of the last deploy. Re-rendering could not change it: the insight is
// a pure function of its inputs and the input was a constant.
//
// News is the one input that genuinely moves daily. The last sync replaced 104
// of 200 stories, while vendor scores moved on 5 of 47 and reputation on none.
//
// Two things this has to handle that the shared server fetcher does not.
//
// The upstream ignores ?limit and returns the entire archive: 2,865 items and
// 3.28MB, whatever is asked for. Verified, not assumed. So the payload is
// trimmed here, right after parsing, and only the trimmed set is held.
//
// And the refresh interval is a day rather than the shared fetcher's five
// minutes, because that is the cadence this is meant to run at and because
// pulling 3.28MB every five minutes per instance to re-pick one headline is
// not a trade worth making.

const NEWS_URL = "https://ranking-engine-red.vercel.app/api/news";
const TIMEOUT_MS = 12_000;
const TTL_MS = 24 * 60 * 60 * 1000;

// Enough to pick from with room for filtering by impact and category, and far
// below the 2,865 the source would otherwise hand over. The insight only ever
// shows one item.
const KEEP = 300;

export interface AnalystNews {
  items: NewsItemRaw[];
  /** "aie-live" when this render reached upstream, "aie" when it fell back. */
  lane: "aie-live" | "aie";
  /** Set only on a fallback: when the recorded payload was captured. */
  recordedAt?: string;
  /** When this process last reached upstream, for the page to date itself. */
  fetchedAt: string;
}

let cached: { value: AnalystNews; at: number } | null = null;

function trim(items: NewsItemRaw[]): NewsItemRaw[] {
  return [...items]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, KEEP);
}

async function fromFixture(): Promise<AnalystNews> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "fixtures", "aie-live", "news.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as { news?: NewsItemRaw[]; asOf?: string };
    return {
      items: trim(parsed.news ?? []),
      lane: "aie",
      recordedAt: parsed.asOf,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // No news is a legitimate state: the insight renders without its dated
    // item rather than failing the page.
    return { items: [], lane: "aie", fetchedAt: new Date().toISOString() };
  }
}

export async function analystNews(): Promise<AnalystNews> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(NEWS_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      // Next's own fetch cache would hold the untrimmed 3.28MB. This module
      // caches the trimmed result instead.
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const parsed = (await res.json()) as { news?: NewsItemRaw[] };
      const value: AnalystNews = {
        items: trim(parsed.news ?? []),
        lane: "aie-live",
        fetchedAt: new Date().toISOString(),
      };
      cached = { value, at: Date.now() };
      return value;
    }
  } catch {
    // Fall through to the recorded payload: real but dated beats blank.
  }

  const value = await fromFixture();
  cached = { value, at: Date.now() };
  return value;
}
