// Backfills a real quarterly series behind the developer reputation pillar.
//
// The reputation dataset publishes point-in-time pillar scores and no history
// at all, so those scores cannot be plotted over time without inventing the
// past. What CAN be backfilled is one of the observable signals underneath
// them: Hacker News discussion, which is queryable by date range and returns
// genuine per-quarter counts.
//
// So this is explicitly NOT "reputation score history". It is developer
// discussion volume and reception, per quarter, per vendor, from a named
// public source. The chart built on it must say so.
//
// Two accuracy notes that materially change the numbers:
//  - Queries are exact-quoted. Loose matching turns "Cohere" into "coherent"
//    and inflates it by two orders of magnitude (132,765 vs 1,054).
//  - Some vendor names still collide with unrelated companies even quoted
//    (there is a different Cohere, a YC user-support company). Those vendors
//    carry an ambiguity flag rather than being silently trusted.

import { writeFileSync } from "node:fs";

const UA = "AI Enterprise demo research michael@talentgenius.io";
const SLEEP = 260;
const QUARTERS = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// vendorId, display name, exact query, ambiguity note.
const VENDORS = [
  ["openai", "OpenAI", "OpenAI", null],
  ["anthropic", "Anthropic", "Anthropic", null],
  ["google", "Google DeepMind", "DeepMind", null],
  ["mistral", "Mistral", "Mistral AI", null],
  ["meta", "Meta (Llama)", "Llama", "Also matches the animal and unrelated projects."],
  ["deepseek", "DeepSeek", "DeepSeek", null],
  ["xai", "xAI (Grok)", "Grok", null],
  ["cohere", "Cohere", "Cohere", "A different Cohere (YC user support) shares the name."],
  ["moonshot", "Moonshot (Kimi)", "Kimi", null],
  ["alibaba", "Alibaba (Qwen)", "Qwen", null],
];

function lastQuarters(n) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3) + 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
    out.push({ year: y, quarter: q });
  }
  return out.reverse();
}

function bounds({ year, quarter }) {
  const startMonth = (quarter - 1) * 3;
  const start = Date.UTC(year, startMonth, 1) / 1000;
  const end = Date.UTC(year, startMonth + 3, 1) / 1000;
  return { start: Math.floor(start), end: Math.floor(end) };
}

async function quarterStats(query, period) {
  const { start, end } = bounds(period);
  const url =
    "https://hn.algolia.com/api/v1/search?" +
    new URLSearchParams({
      query: `"${query}"`,
      numericFilters: `created_at_i>${start},created_at_i<${end}`,
      hitsPerPage: "50",
      tags: "story",
    });
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    await sleep(SLEEP);
    if (!res.ok) return null;
    const d = await res.json();
    const hits = d.hits ?? [];
    const points = hits
      .map((h) => h.points)
      .filter((p) => typeof p === "number");
    const comments = hits
      .map((h) => h.num_comments)
      .filter((p) => typeof p === "number");
    const mean = (a) =>
      a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null;
    return {
      stories: d.nbHits ?? 0,
      meanPoints: mean(points),
      meanComments: mean(comments),
      sampled: hits.length,
    };
  } catch {
    return null;
  }
}

const periods = lastQuarters(QUARTERS);
const label = (p) => `${p.year}Q${p.quarter}`;
const vendors = [];

for (const [vendorId, name, query, ambiguity] of VENDORS) {
  const series = [];
  for (const p of periods) {
    const s = await quarterStats(query, p);
    series.push({
      period: label(p),
      year: p.year,
      quarter: p.quarter,
      stories: s?.stories ?? null,
      meanPoints: s?.meanPoints ?? null,
      meanComments: s?.meanComments ?? null,
    });
  }
  const counts = series.map((s) => s.stories).filter((n) => typeof n === "number");
  vendors.push({
    vendorId,
    name,
    query,
    ambiguity,
    series,
    total: counts.reduce((a, b) => a + b, 0),
  });
  console.error(
    `${name.padEnd(18)} ${series.map((s) => String(s.stories ?? "-").padStart(6)).join("")}`
  );
}

writeFileSync(
  new URL("../fixtures/reputation-history.json", import.meta.url),
  JSON.stringify(
    {
      metric: "Hacker News story volume and reception per quarter",
      provenance:
        "Hacker News via the Algolia search API, exact-quoted vendor queries, story items only. A real observable signal behind the developer reputation pillar. NOT a reputation score history: the reputation dataset publishes point-in-time pillar scores and no history, so those cannot be plotted over time without inventing the past.",
      source: "hn.algolia.com",
      capturedAt: new Date().toISOString().slice(0, 10),
      quarters: periods.map(label),
      vendors,
    },
    null,
    1
  )
);
console.error(`\n${vendors.length} vendors x ${QUARTERS} quarters written`);
