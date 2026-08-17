// News-driven capability update for the integrator layer.
//
// WHAT IT PRODUCES, AND WHAT IT DOES NOT. It writes a dated, cited register of
// capability EVENTS per integrator. It does not touch a score. The assessment
// and AI-readiness numbers on the delivery panel are BoardRadar's and are
// read-only from here, so a script that quietly adjusted them would be
// inventing a figure and attributing it to somebody else.
//
// What a buyer can use is the event itself: "IBM and OpenAI announce strategic
// partnership" changes what IBM can deliver next quarter in a way no static
// capability score will show for months. So the register carries the event, its
// date, its source and which frontier vendor it involves, and leaves the
// scoring alone.
//
// CLASSIFICATION IS PATTERN-MATCHED, NOT MODELLED. Four event types, each keyed
// on language the headline actually uses. A model could read intent better, but
// it would also invent a category for an item that has none, and the whole
// value here is that every row traces to a headline somebody can open. Where an
// item matches nothing it is recorded as `unclassified` rather than forced into
// the nearest bucket.
//
// Usage:  node scripts/integrator-capability-update.mjs
//         node scripts/integrator-capability-update.mjs --dry

import { writeFileSync } from "node:fs";

const BASE = "https://newaient30072026.vercel.app";
// News comes from the ranking engine directly, not our own /api/aie/news, which
// answers with 60 items. The engine returns its full feed and the whole point of
// this pass is reach: at 60 items it found one event across 48 integrators.
const NEWS_BASE = "https://ranking-engine-red.vercel.app";
const OUT = "data/integrators/capability-events.json";
const DRY = process.argv.includes("--dry");

const INTEGRATOR_SECTORS = ["global-si", "consulting"];
const NOT_INTEGRATION_SEGMENTS = new Set([
  "Financial Technology Services",
  "Enterprise BPO",
]);

// Frontier vendors whose name beside an integrator is the signal.
const FRONTIER = [
  "OpenAI", "Anthropic", "Google", "Microsoft", "NVIDIA", "AWS", "Amazon",
  "Meta", "Mistral", "Cohere", "Databricks", "Snowflake", "ServiceNow",
  "Salesforce", "SAP", "Together AI",
];

// Event types, most specific first: a headline saying "acquires" and
// "partnership" is an acquisition.
const EVENT_TYPES = [
  ["acquisition", /\b(acquir|acquisition|buys|to buy|takeover)\b/i],
  ["partnership", /\b(partner|partnership|alliance|teams? up|collaborat)\b/i],
  ["deal", /\b(deal|contract|agreement|signs?|\$\d|billion|million)\b/i],
  ["launch", /\b(launch|unveil|introduc|releases?|debuts?|rolls? out)\b/i],
];

function wordMatch(text, needle) {
  return new RegExp(
    `\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  ).test(text);
}

function classify(title) {
  for (const [type, re] of EVENT_TYPES) if (re.test(title)) return type;
  return "unclassified";
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const provs = await getJson("/api/br/providers");
  const integrators = (provs.providers ?? []).filter(
    (p) =>
      INTEGRATOR_SECTORS.includes(p.sector) &&
      !NOT_INTEGRATION_SEGMENTS.has(p.segment)
  );
  if (integrators.length === 0) {
    throw new Error("no integrators resolved; refusing to write an empty register");
  }

  const newsRes = await (async () => {
    const res = await fetch(`${NEWS_BASE}/api/news`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`news: HTTP ${res.status}`);
    return res.json();
  })();
  const items = newsRes.news ?? newsRes.items ?? [];
  if (items.length === 0) {
    throw new Error("news feed returned nothing; refusing to write an empty register");
  }

  const byIntegrator = {};
  let events = 0;
  for (const p of integrators) {
    const names = [p.displayName, p.name].filter(Boolean);
    const hits = [];
    for (const it of items) {
      const title = it.title ?? "";
      const summary = it.whyItMatters ?? "";
      const inTitle = names.some((n) => wordMatch(title, n));
      const inSummary = !inTitle && names.some((n) => wordMatch(summary, n));
      if (!inTitle && !inSummary) continue;
      // ONLY A HEADLINE MATCH IS AN EVENT ABOUT THIS INTEGRATOR.
      //
      // The event type is read off the headline, and where the integrator is
      // named only in somebody else's summary the headline is about somebody
      // else. Classifying those produced Accenture rows reading "partnership:
      // Cognizant Expands Partnership with Anthropic", which would tell a buyer
      // Accenture partnered with Anthropic when Cognizant did.
      //
      // Summary matches are kept, because being named in coverage of a rival's
      // deal is worth seeing, but they carry no event type and are counted
      // apart.
      hits.push({
        event: inTitle ? classify(title) : null,
        title,
        publishedAt: it.publishedAt ?? null,
        sourceName: it.sourceName ?? null,
        sourceUrl: it.sourceUrl ?? null,
        // A headline match is a stronger claim about the integrator than a
        // mention buried in somebody else's summary. Recorded, never merged.
        matchedIn: inTitle ? "headline" : "summary",
        alongside: FRONTIER.filter(
          (f) =>
            !names.some((n) => n.toLowerCase() === f.toLowerCase()) &&
            wordMatch(title, f)
        ),
      });
      events += 1;
    }
    if (hits.length > 0) byIntegrator[p.ticker] = { name: p.displayName, hits };
  }

  const reached = Object.keys(byIntegrator).length;
  const headline = Object.values(byIntegrator).reduce(
    (n, v) => n + v.hits.filter((h) => h.matchedIn === "headline").length,
    0
  );
  const mentions = events - headline;

  console.log(`integrators in scope      ${integrators.length}`);
  console.log(`news items scanned        ${items.length}`);
  console.log(`integrators with a signal ${reached}`);
  console.log(`capability events         ${headline}  (headline matches only)`);
  console.log(`mentions, not events      ${mentions}  (named in another firm's story)`);
  console.log("");
  for (const [tk, v] of Object.entries(byIntegrator).sort(
    (a, b) => b[1].hits.length - a[1].hits.length
  )) {
    const own = v.hits.filter((h) => h.matchedIn === "headline");
    if (own.length === 0) continue;
    const types = own.reduce((m, h) => ({ ...m, [h.event]: (m[h.event] ?? 0) + 1 }), {});
    console.log(
      `  ${tk.padEnd(11)} ${String(v.name).padEnd(24)} ${String(own.length).padStart(2)}  ${JSON.stringify(types)}`
    );
  }

  const payload = {
    note:
      "Capability EVENTS, not scores. The assessment and AI-readiness figures " +
      "on the delivery panel belong to BoardRadar and are not touched here. " +
      "Classification is pattern-matched from the headline; an item matching " +
      "nothing is recorded as unclassified rather than forced into a bucket.",
    coverage: {
      integratorsInScope: integrators.length,
      integratorsWithSignal: reached,
      newsItemsScanned: items.length,
      capabilityEvents: headline,
      mentionsNotEvents: mentions,
    },
    capturedAt: new Date().toISOString(),
    integrators: byIntegrator,
  };

  if (DRY) {
    console.log("\n--dry: nothing written");
    return;
  }
  writeFileSync(OUT, JSON.stringify(payload, null, 1) + "\n");
  console.log(`\nwrote ${OUT}`);
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  console.error("Nothing was written.");
  process.exit(1);
});
