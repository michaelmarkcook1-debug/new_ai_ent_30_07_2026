// Federal Register connector: how much US rulemaking touches AI.
//
// Verified live on 4 August 2026: 1,521 documents matching "artificial
// intelligence", newest dated the previous day. Keyless, official, and the
// freshest signal in this build.
//
// This is an obligations signal, not an adoption one, and it sits alongside
// the disclosure counts rather than being blended into them. It answers "is
// the regulatory ground moving under this decision", which is a question a
// CIO asks at the same moment as "who else has bought this".

import { FEDERAL_REGISTER } from "./sources";
import type { ConnectorHealth, FetchOutcome, RegulatoryPulse } from "./types";

const BASE = "https://www.federalregister.gov/api/v1/documents.json";
const TIMEOUT_MS = 12_000;

interface FrDoc {
  title?: string;
  publication_date?: string;
  html_url?: string;
  type?: string;
}

interface FrResponse {
  count?: number;
  results?: FrDoc[];
}

/** AI rulemaking volume over a window, with the newest document named. */
export async function fetchRegulatoryPulse(
  sinceDays = 365
): Promise<FetchOutcome<RegulatoryPulse>> {
  const since = new Date(Date.now() - sinceDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const params = new URLSearchParams();
  params.set("conditions[term]", "artificial intelligence");
  params.set("conditions[publication_date][gte]", since);
  params.set("order", "newest");
  params.set("per_page", "20");
  const url = `${BASE}?${params.toString()}`;
  const fetchedAt = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        records: [],
        fetchedAt,
        sourceUrl: url,
        error: `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as FrResponse;
    const results = body.results ?? [];
    const counts = new Map<string, number>();
    for (const d of results) {
      const t = d.type ?? "Unknown";
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const newest = results[0];
    const pulse: RegulatoryPulse = {
      totalDocuments: body.count ?? 0,
      window: `since ${since}`,
      newest: newest
        ? {
            title: newest.title ?? "Untitled",
            publishedOn: newest.publication_date ?? "",
            url: newest.html_url ?? "",
          }
        : null,
      // Type mix is over the newest page only, and the label says so rather
      // than implying it describes all 1,500 documents.
      byType: [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      fetchedAt,
      source: FEDERAL_REGISTER,
    };
    return { ok: true, status: "ok", records: [pulse], fetchedAt, sourceUrl: url };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      records: [],
      fetchedAt,
      sourceUrl: url,
      error: e instanceof Error ? e.message : "network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function federalRegisterHealth(): ConnectorHealth {
  return {
    id: FEDERAL_REGISTER.id,
    label: FEDERAL_REGISTER.name,
    status: "ok",
    configured: true,
    source: FEDERAL_REGISTER,
  };
}
