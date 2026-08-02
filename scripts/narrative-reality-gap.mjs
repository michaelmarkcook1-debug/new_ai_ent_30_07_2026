// Compiles a narrative-versus-reality read for every tracked AI vendor.
//
// The Pulse spotlight carries a hand-written read for four vendors. This
// produces a derived one for the rest, from measured inputs only. Nothing here
// invents a narrative or reality score: both sides are computed from sources
// that can be re-fetched and checked, and a vendor the inputs do not reach is
// recorded as null rather than filled in.
//
// REALITY  evidence-weighted capability maturity from the AIE capability
//          matrix. Each row carries a maturityScore and an evidence grade, and
//          a high score asserted at E1 is not worth the same as one verified at
//          E5, so the mean is weighted by grade. 470 rows cover all 43 vendors.
//
// NARRATIVE  two independent measures of how much the conversation carries the
//          vendor, each ranked on its own scale and then averaged. No blend
//          weight is invented: a source either has a reading for a vendor or
//          it does not, and the average is taken over the ones that do.
//
//          1. AIE news items tagged to the vendor. Curated and tagged by
//             vendor id, so there is no name ambiguity at all.
//          2. Hacker News stories whose URL is the vendor's own domain.
//
// Neither works alone, which is why both are here. Measured directly:
//   TSMC       domain 0    name 146   third-party press, own site never linked
//   Alibaba    domain 0    name 154   same
//   Writer     domain 3    name 232   "writer" the common noun
//   Lambda     domain 3    name 241   AWS Lambda and lambda calculus
//   MiniMax    domain 9    name 122   the game-tree algorithm
// Domain anchoring undercounts vendors covered by others; name matching
// overcounts vendors named after ordinary words. Domain anchoring is the one
// that fails safe: it can miss a vendor, but it never counts a different one.
// Name matching is not used, and per-vendor query tuning is deliberately
// avoided, because tuning each query by hand turns a measurement into a
// judgement wearing a measurement's clothes.
//
// Both sides are then percentile-ranked within the cohort, because a raw
// capability score and a raw story count share no scale and subtracting one
// from the other would be meaningless. The gap is the difference of the two
// percentiles: positive means the conversation runs ahead of the evidence,
// negative means the vendor delivers more than it is talked about.
//
// A vendor whose narrative signal is too thin to mean anything gets a null
// gap, not a number. One or two news items is noise, and ranking noise would
// produce a confident reading of nothing.
//
// KNOWN BIAS, stated because it changes how the number should be read: Hacker
// News is a developer audience. It over-covers frontier labs and developer
// infrastructure and under-covers vendors selling to lawyers, clinicians and
// compliance teams. Harvey and Rogo look quiet there because their buyers are
// not on it. The narrative side is therefore developer and technical-press
// attention specifically, not total market narrative, and the output says so.
//
// Usage:  node scripts/narrative-reality-gap.mjs
//         node scripts/narrative-reality-gap.mjs --dry   (print, do not write)

import { writeFileSync } from "node:fs";

const OUT = new URL("../fixtures/narrative-reality-gap.json", import.meta.url);
const BASE = process.env.AIE_BASE ?? "https://newaient30072026.vercel.app/api/aie";
// The news endpoint defaults to 60 items; limit is the only paging control it
// honours, and 200 is where it stops regardless of what is asked for.
const NEWS_LIMIT = 500;
const WINDOW_DAYS = 365;
const DRY = process.argv.includes("--dry");

// Evidence grades discount the maturity they support. A capability claimed at
// E1 is a claim; the same score at E5 has been verified. The weights are a
// judgement, held in one place and applied to every vendor identically.
const EVIDENCE_WEIGHT = { E5: 1.0, E4: 0.9, E3: 0.75, E2: 0.55, E1: 0.35 };

// Vendor id to primary domain. An identifier, not a measurement: it decides
// which URLs count as being about this vendor, and nothing else. Vendors with
// no usable domain are carried with narrative null rather than guessed at.
//
// Getting these wrong suppresses a vendor silently, which is what happened on
// the first pass: Alibaba was pointed at alibabacloud.com and Cerebras at
// cerebras.net, both of which return zero AI stories, so both read as having
// no narrative at all. They ship under qwen.ai and cerebras.ai. A domain that
// returns zero is now worth checking rather than believing.
const DOMAIN = {
  ai21: "ai21.com",
  amd: "amd.com",
  aws: "aws.amazon.com",
  // Alibaba ships its models as Qwen; alibabacloud.com carries the cloud
  // business and returned zero AI stories.
  alibaba: "qwen.ai",
  anthropic: "anthropic.com",
  broadcom: "broadcom.com",
  // cerebras.net is the legacy domain and returns zero; the AI site is .ai.
  cerebras: "cerebras.ai",
  cohere: "cohere.com",
  coreweave: "coreweave.com",
  databricks: "databricks.com",
  deepseek: "deepseek.com",
  fireworks: "fireworks.ai",
  g42: "tii.ae",
  glean: "glean.com",
  google: "deepmind.com",
  groq: "groq.com",
  harvey: "harvey.ai",
  hebbia: "hebbia.ai",
  humain: "humain.com",
  ibm: "ibm.com",
  lambda: "lambdalabs.com",
  meta: "ai.meta.com",
  microsoft: "microsoft.com",
  minimax: "minimaxi.com",
  mistral: "mistral.ai",
  moonshot: "moonshot.ai",
  moveworks: "moveworks.com",
  nscale: "nscale.com",
  nvidia: "nvidia.com",
  openai: "openai.com",
  oracle: "oracle.com",
  perplexity: "perplexity.ai",
  rogo: "rogo.ai",
  sakana: "sakana.ai",
  salesforce: "salesforce.com",
  sap: "sap.com",
  servicenow: "servicenow.com",
  snowflake: "snowflake.com",
  together: "together.ai",
  tsmc: "tsmc.com",
  writer: "writer.com",
  xai: "x.ai",
  zai: "z.ai",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.ok) return await res.json();
    } catch {
      /* retried below */
    }
    await sleep(500 * (i + 1));
  }
  throw new Error(`failed after ${tries}: ${url}`);
}

// Hacker News story volume for one domain, plus the engagement those stories
// drew. Volume alone would treat a story nobody read as equal to one that ran
// for 600 comments, so points and comments are folded in at a low weight.
async function hnSignal(domain, sinceEpoch) {
  const params = new URLSearchParams({
    query: domain,
    restrictSearchableAttributes: "url",
    tags: "story",
    numericFilters: `created_at_i>${sinceEpoch}`,
    hitsPerPage: "100",
  });
  const j = await getJson(`https://hn.algolia.com/api/v1/search?${params}`);
  const hits = j.hits ?? [];
  const points = hits.reduce((a, h) => a + (h.points ?? 0), 0);
  const comments = hits.reduce((a, h) => a + (h.num_comments ?? 0), 0);
  return { stories: j.nbHits ?? 0, points, comments, sampled: hits.length };
}

// Percentile rank within the cohort, 0 to 100. Ties share the midpoint so a
// block of equal values does not hand one of them an arbitrary advantage.
function percentiles(entries) {
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const out = new Map();
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j++;
    const rank = (i + j) / 2;
    const pct =
      sorted.length === 1 ? 50 : Math.round((rank / (sorted.length - 1)) * 1000) / 10;
    for (let k = i; k <= j; k++) out.set(sorted[k].id, pct);
    i = j + 1;
  }
  return out;
}

const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

async function main() {
  const sinceEpoch = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 24 * 3600;

  const [vendorsRes, capsRes, newsRes] = await Promise.all([
    getJson(`${BASE}/vendors`),
    getJson(`${BASE}/capabilities`),
    getJson(`${BASE}/news?limit=${NEWS_LIMIT}`),
  ]);

  const allVendors = vendorsRes.vendors ?? vendorsRes.data ?? [];
  const catName = (v) =>
    typeof v.category === "object" ? v.category?.name : v.category;

  // Investors fund AI vendors rather than sell AI, so a narrative-versus-
  // reality read on one answers no buying question. Same exclusion the Pulse
  // picker makes, for the same reason.
  const vendors = allVendors.filter((v) => catName(v) !== "AI investor");

  const capRows = capsRes.vendorCapabilities ?? [];
  const news = newsRes.news ?? [];

  const byVendorCaps = new Map();
  for (const r of capRows) {
    if (!byVendorCaps.has(r.vendorId)) byVendorCaps.set(r.vendorId, []);
    byVendorCaps.get(r.vendorId).push(r);
  }

  const newsByVendor = new Map();
  for (const n of news) {
    for (const vid of n.vendors ?? []) {
      if (!newsByVendor.has(vid)) newsByVendor.set(vid, []);
      newsByVendor.get(vid).push(n);
    }
  }

  console.error(
    `${vendors.length} AI vendors, ${capRows.length} capability rows, ${news.length} news items`
  );

  // Capability names, for the portfolio breakdown below.
  const capName = new Map(
    (capsRes.capabilities ?? []).map((c) => [c.id, c.name])
  );

  const rows = [];
  for (const v of vendors) {
    // REALITY
    const caps = byVendorCaps.get(v.id) ?? [];
    const graded = caps.filter(
      (c) => typeof c.maturityScore === "number" && EVIDENCE_WEIGHT[c.evidenceGrade]
    );
    let reality = null;
    let weightSum = 0;
    if (graded.length) {
      let num = 0;
      for (const c of graded) {
        const w = EVIDENCE_WEIGHT[c.evidenceGrade];
        num += c.maturityScore * w;
        weightSum += w;
      }
      reality = num / weightSum;
    }
    const grades = graded.map((c) => c.evidenceGrade).sort();
    const weakest = grades.length ? grades[0] : null;

    // NARRATIVE
    const domain = DOMAIN[v.id] ?? null;
    let hn = null;
    if (domain) {
      hn = await hnSignal(domain, sinceEpoch);
      await sleep(120); // stay well inside the public rate limit
      console.error(
        `  ${v.name.padEnd(24)} ${domain.padEnd(22)} ${hn.stories} stories`
      );
    } else {
      console.error(`  ${v.name.padEnd(24)} (no domain mapped, narrative null)`);
    }

    const vNews = newsByVendor.get(v.id) ?? [];
    const sentiments = vNews
      .map((n) => n.sentiment)
      .filter((s) => typeof s === "string");
    const positive = sentiments.filter((s) => s === "positive").length;
    const negative = sentiments.filter((s) => s === "negative").length;

    // Per-capability reality, kept per vendor so the card can show where a
    // portfolio diverges from its own headline. A single overall number hides
    // exactly the thing a buyer needs: a vendor strong on average can be weak
    // precisely where their use case lives.
    const perCapability = graded.map((c) => ({
      capabilityId: c.capabilityId,
      capability: capName.get(c.capabilityId) ?? c.capabilityId,
      maturity: c.maturityScore,
      evidenceGrade: c.evidenceGrade,
      status: c.status ?? null,
    }));

    rows.push({
      vendorId: v.id,
      name: v.name,
      perCapability,
      category: catName(v),
      marketPosition: v.marketPosition ?? null,
      reality: round1(reality),
      realityRows: graded.length,
      realityWeakestEvidence: weakest,
      realityWeight: round1(weightSum),
      domain,
      hn,
      aieNews: { items: vNews.length, positive, negative },
    });
  }

  // Percentile-rank both sides across the vendors that have each signal.
  const realityPct = percentiles(
    rows.filter((r) => r.reality !== null).map((r) => ({ id: r.vendorId, value: r.reality }))
  );

  // Each narrative source is ranked on its own scale. HN volume folds in the
  // engagement those stories drew, at quarter weight, so a story nobody read
  // does not count the same as one that ran for 600 comments. log1p keeps
  // OpenAI from flattening everyone else into one bucket at the bottom.
  const hnValue = (r) =>
    r.hn === null
      ? null
      : Math.log1p(r.hn.stories) +
        0.25 * Math.log1p(r.hn.points) +
        0.25 * Math.log1p(r.hn.comments);

  const hnPct = percentiles(
    rows.filter((r) => hnValue(r) !== null).map((r) => ({ id: r.vendorId, value: hnValue(r) }))
  );
  const newsPct = percentiles(
    rows.filter((r) => r.aieNews.items > 0).map((r) => ({ id: r.vendorId, value: r.aieNews.items }))
  );

  // Enough signal to be worth ranking. Below this the inputs are noise, and a
  // percentile over noise still looks like a confident answer.
  const MIN_NEWS = 3;
  const MIN_HN_STORIES = 10;

  // Percentile-rank each capability across the cohort separately, so a
  // vendor's standing on governance is measured against other vendors'
  // governance rather than against its own agents score.
  const capIds = new Set(rows.flatMap((r) => r.perCapability.map((c) => c.capabilityId)));
  const capPct = new Map();
  for (const capId of capIds) {
    const entries = rows
      .map((r) => {
        const c = r.perCapability.find((x) => x.capabilityId === capId);
        return c ? { id: r.vendorId, value: c.maturity } : null;
      })
      .filter(Boolean);
    capPct.set(capId, percentiles(entries));
  }

  for (const r of rows) {
    r.realityScore = realityPct.has(r.vendorId) ? realityPct.get(r.vendorId) : null;

    const parts = [];
    const usedSources = [];
    if (r.aieNews.items >= MIN_NEWS && newsPct.has(r.vendorId)) {
      parts.push(newsPct.get(r.vendorId));
      usedSources.push("aie-news");
    }
    if (r.hn && r.hn.stories >= MIN_HN_STORIES && hnPct.has(r.vendorId)) {
      parts.push(hnPct.get(r.vendorId));
      usedSources.push("hn-domain");
    }

    r.narrativeSources = usedSources;
    r.narrativeScore = parts.length
      ? round1(parts.reduce((a, b) => a + b, 0) / parts.length)
      : null;

    r.gap =
      r.realityScore === null || r.narrativeScore === null
        ? null
        : round1(r.narrativeScore - r.realityScore);
    r.direction =
      r.gap === null
        ? "not enough narrative signal"
        : r.gap >= 15
          ? "narrative ahead of reality"
          : r.gap <= -15
            ? "reality ahead of narrative"
            : "narrative and reality aligned";

    // Where this vendor's portfolio departs from its own overall standing.
    // Divergence is measured against the vendor's own reality percentile, so
    // it reads as "soft spot for them" rather than "weak in the market".
    const base = r.realityScore;
    r.portfolio = base === null
      ? []
      : r.perCapability
          .map((c) => {
            const pct = capPct.get(c.capabilityId)?.get(r.vendorId) ?? null;
            return pct === null
              ? null
              : {
                  ...c,
                  percentile: pct,
                  divergence: round1(pct - base),
                  // An unverified claim is its own kind of mismatch: the
                  // capability is asserted but the evidence behind it is thin.
                  thinEvidence: c.evidenceGrade === "E1" || c.evidenceGrade === "E2",
                };
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence));
  }

  rows.sort((a, b) => (b.gap ?? -999) - (a.gap ?? -999));

  const measured = rows.filter((r) => r.gap !== null).length;
  const out = {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    vendorCount: rows.length,
    measuredCount: measured,
    method: {
      reality:
        "Evidence-weighted mean of AIE capability maturity scores, weighted E5 1.0, E4 0.9, E3 0.75, E2 0.55, E1 0.35, then percentile-ranked within the tracked AI vendor set.",
      narrative:
        "Two sources, each percentile-ranked on its own scale and then averaged over whichever have a reading: AIE news items tagged to the vendor, and Hacker News stories whose URL is the vendor's own domain, the latter combined with the points and comments those stories drew at quarter weight and log-scaled. Matching on the domain rather than the name is deliberate: it can miss a vendor but never counts a different one.",
      portfolio:
        "Each capability is percentile-ranked across the tracked set on its own, then compared with the vendor's overall reality percentile. A capability far below that line is a soft spot the headline score hides; far above it is a genuine standout. Evidence grade is carried through, because a capability asserted at E1 or E2 is a claim rather than a verified strength.",
      gap: "Narrative percentile minus reality percentile. Positive means the technical conversation runs ahead of the evidenced capability; negative means the vendor delivers more than it is talked about.",
      threshold:
        "A vendor needs at least 3 tagged news items or at least 10 domain-matched stories before either source counts. Below that the input is noise, and ranking noise would still read as a confident answer, so the gap is left null.",
      bias: "Hacker News is a developer audience. It over-covers frontier labs and developer infrastructure and under-covers vendors selling into law, medicine and compliance, whose buyers are not on it. Domain matching also undercounts vendors whose coverage sits on third-party press rather than their own site. Read the narrative side as developer and technical-press attention, not as total market narrative.",
    },
    sources: [
      `${BASE}/capabilities`,
      `${BASE}/vendors`,
      `${BASE}/news?limit=${NEWS_LIMIT}`,
      "https://hn.algolia.com/api/v1/search",
    ],
    vendors: rows,
  };

  if (DRY) {
    console.error("\n--- dry run, nothing written ---");
  } else {
    writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.error(`\nwrote ${rows.length} vendors (${measured} measurable) to fixtures/narrative-reality-gap.json`);
  }

  console.error("\nlargest narrative lead:");
  for (const r of rows.filter((x) => x.gap !== null).slice(0, 6))
    console.error(`  ${String(r.gap).padStart(6)}  ${r.name}`);
  console.error("largest reality lead:");
  for (const r of rows.filter((x) => x.gap !== null).slice(-6))
    console.error(`  ${String(r.gap).padStart(6)}  ${r.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
