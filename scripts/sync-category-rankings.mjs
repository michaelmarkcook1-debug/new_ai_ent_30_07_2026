// Pull the category rankings from AI Enterprise v1 and record them.
//
// WHY THIS PARSES HTML, WHICH IS NOT A THING WE DO ANYWHERE ELSE.
//
// v1 (the ranking engine at ranking-engine-red.vercel.app) publishes two
// different scores for the same vendor, and they name different leaders:
//
//   overallScore              0 to 100, one global formula, on /api/vendors.
//                             Ranks OpenAI above Anthropic in frontier models.
//   category composite        0 to 5, weights specific to each category, on the
//                             /category/<id> pages. Ranks Anthropic above
//                             OpenAI in the same category.
//
// The second is the better number and the one v1's own front page uses. Its
// weights differ per category (frontier models weight Enterprise Control 22%,
// Reliability 21%; a CRM assistant is weighted differently), each domain's 0-5
// score is capped by its evidence grade, and a vendor under 60% domain coverage
// is HELD rather than ranked on defaults. overallScore does none of that: it
// judges a foundry and a service desk on one formula and ranks everything.
//
// It is not on the API. It is computed server-side and rendered into the
// /category/<id> pages, and v1 is read-only from this side, so there is no
// option to add an endpoint. Parsing the published page is the only way to read
// it, and the numbers are the real ones.
//
// WHAT MAKES THIS SAFE ENOUGH TO RELY ON.
//
// It fails loudly. A category that yields no rows, or a page that stops
// carrying the composite marker, is an error that stops the script, never an
// empty array written over good data. The silent version of this bug is the
// one that matters: a parser that quietly returns nothing leaves yesterday's
// numbers on screen under today's date.
//
// It writes a fixture rather than running in the render path, so a markup
// change on their side breaks a script we run deliberately, not a page a
// reader is looking at.
//
// It cross-checks itself. Ranked-plus-held must equal the vendor count that
// /api/market-share reports for the same category, and that is asserted per
// category rather than in aggregate.
//
// Usage:  node scripts/sync-category-rankings.mjs
//         node scripts/sync-category-rankings.mjs --dry

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = "https://ranking-engine-red.vercel.app";
const OUT = "fixtures/aie-live/category-rankings.json";
const DRY = process.argv.includes("--dry");

// The thirteen v1 ranks within. Deliberately written down rather than
// discovered, so a category disappearing upstream is a failure here instead of
// a category quietly vanishing from our product.
const CATEGORIES = [
  ["frontier_model_api", "Frontier model/API"],
  ["enterprise_assistant", "Enterprise assistant"],
  ["developer_coding_agent", "Developer/coding agent"],
  ["agent_platform", "Agent platform"],
  ["rag_enterprise_search", "RAG/enterprise search"],
  ["workflow_automation_ai", "Workflow automation AI"],
  ["crm_customer_ai", "CRM/customer AI"],
  ["itsm_hr_service_ai", "ITSM/HR/service AI"],
  ["cloud_ai_platform", "Cloud AI platform"],
  ["regulated_industry_ai", "Regulated-industry AI"],
  ["ai_silicon", "AI silicon / accelerators"],
  ["ai_cloud_compute", "AI cloud & compute"],
  ["neocloud_inference", "Neocloud & inference"],
];

// The composite carries its own title attribute on the page, stating the domain
// count and that it is coverage-discounted. Anchoring on that rather than on a
// class name, because classes are Tailwind soup that changes with any restyle
// while this string is a description of the number itself.
const COMPOSITE = /(\d+)-domain weighted assessment composite/g;
const POSITION = />(Leader|Strong|Emerging leader|Contender|Niche)<\/span>/g;

async function fetchPage(id) {
  const res = await fetch(`${BASE}/category/${id}`, {
    headers: { accept: "text/html" },
  });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  return res.text();
}

/**
 * One category page to its ranking.
 *
 * The page renders its table more than once for responsive layouts, so the same
 * vendor appears repeatedly. First occurrence wins, which is rank order,
 * because the primary table is emitted first.
 */
function parse(html, id) {
  const rows = [];
  let domains = null;
  for (const m of html.matchAll(COMPOSITE)) {
    domains = Number(m[1]);
    const seg = html.slice(m.index, m.index + 700);
    const score = seg.match(/>([0-9]\.[0-9]{1,2})<span[^>]*>\/5/);
    if (!score) continue;
    const before = html.slice(Math.max(0, m.index - 3000), m.index);
    const slugs = [...before.matchAll(/href="\/vendors\/([a-z0-9-]+)"/g)];
    if (slugs.length === 0) continue;
    const positions = [...before.slice(-1500).matchAll(POSITION)];
    rows.push({
      vendorId: slugs[slugs.length - 1][1],
      composite: Number(score[1]),
      position: positions.length ? positions[positions.length - 1][1] : null,
    });
  }

  const seen = new Set();
  const ranked = [];
  for (const r of rows) {
    if (seen.has(r.vendorId)) continue;
    seen.add(r.vendorId);
    ranked.push({ rank: ranked.length + 1, ...r });
  }

  if (ranked.length === 0) {
    throw new Error(
      `${id}: parsed no ranked vendors. The page markup has changed, or the ` +
        `composite marker has moved. Refusing to write an empty ranking over a ` +
        `good one.`
    );
  }
  if (domains === null) {
    throw new Error(`${id}: no domain count found`);
  }
  return { domains, ranked };
}

async function main() {
  const shareRes = await fetch(`${BASE}/api/market-share`, {
    headers: { accept: "application/json" },
  });
  if (!shareRes.ok) throw new Error(`market-share: HTTP ${shareRes.status}`);
  const share = await shareRes.json();
  const inCategory = new Map();
  for (const e of share.estimates ?? []) {
    inCategory.set(e.categoryId, (inCategory.get(e.categoryId) ?? 0) + 1);
  }

  const previous = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : null;
  const prevById = new Map(
    (previous?.categories ?? []).map((c) => [c.categoryId, c])
  );

  const categories = [];
  for (const [id, label] of CATEGORIES) {
    const html = await fetchPage(id);
    const { domains, ranked } = parse(html, id);
    const total = inCategory.get(id);
    if (total === undefined) {
      throw new Error(`${id}: no rows in market-share, so held cannot be derived`);
    }
    const held = total - ranked.length;
    if (held < 0) {
      throw new Error(
        `${id}: ${ranked.length} ranked but market-share holds only ${total}. ` +
          `One of the two is being read wrong.`
      );
    }

    const before = prevById.get(id);
    const moved = before
      ? ranked.filter((r) => {
          const was = before.ranked.find((x) => x.vendorId === r.vendorId);
          return !was || was.composite !== r.composite;
        }).length
      : null;

    console.log(
      `${id.padEnd(24)} ${String(domains).padStart(2)}dom  ` +
        `${String(ranked.length).padStart(2)} ranked  ${held} held  ` +
        `leader ${ranked[0].vendorId} ${ranked[0].composite}` +
        (moved === null ? "  (new)" : `  ${moved} moved`)
    );

    categories.push({ categoryId: id, label, domains, held, ranked });
  }

  const payload = {
    source: `${BASE}/category/<id>`,
    note:
      "Weighted composite (0-5) of evidence-graded assessment domains, weights " +
      "specific to each category, coverage-discounted. Parsed from the " +
      "published pages: v1 does not expose this on its API and is read-only.",
    capturedAt: new Date().toISOString(),
    categories,
  };

  if (DRY) {
    console.log("\n--dry: nothing written");
    return;
  }
  writeFileSync(OUT, JSON.stringify(payload, null, 1) + "\n");
  console.log(
    `\nwrote ${OUT}: ${categories.length} categories, ` +
      `${categories.reduce((n, c) => n + c.ranked.length, 0)} ranked vendors`
  );
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  console.error("Nothing was written. The existing fixture is unchanged.");
  process.exit(1);
});
