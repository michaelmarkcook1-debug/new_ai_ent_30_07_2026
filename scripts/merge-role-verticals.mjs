// Merge the researched sector deltas into the customer-operations pilot.
//
// Michael asked for the merge after being told insurance reviewed as "do not
// merge". That is his call and this does it. What it will not do is write in
// the specific claims that were opened and found not to say what they were
// cited for, because a knowingly false citation is the one thing this product
// cannot ship. Those are held, listed in the file with the reason, and are one
// edit away from being included if he disagrees.
//
// WHAT IS HELD, AND WHY IT IS NOT A JUDGEMENT CALL. Both were read against the
// source on 17 August 2026.
//
//   28 Tex. Admin. Code 13.492   Quoted accurately: seven calendar days to
//                                acknowledge a complaint in writing. Its full
//                                path is Title 28 Insurance, Chapter 13,
//                                Subchapter E, HEALTH CARE COLLABORATIVES. The
//                                section says "HCC" throughout and is about
//                                patients and physicians. It binds a specific
//                                Texas entity type, not insurers, so it cannot
//                                carry a claim about a general insurance
//                                complaints role.
//
//   cima.ky complaints page      Genuine, from the Cayman Islands Monetary
//                                Authority, and about complaints: 57 mentions.
//                                It contains the word "deadline" zero times,
//                                and the claims citing it are about fixed
//                                procedural deadlines.
//
// Everything else merges, including the four no-op deltas where `from` equals
// `to`. Those are reaffirmations rather than changes, and a sector confirming
// that a requirement does not move is a real research finding worth carrying.
//
// Usage:  node scripts/merge-role-verticals.mjs [--dry]

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const PILOT = "data/role-verticals/customer-operations.json";
const PROPOSED = "data/role-verticals/proposed";
const DRY = process.argv.includes("--dry");

// Sources read and found not to support the claims resting on them.
const HELD_SOURCES = new Set([
  "https://www.law.cornell.edu/regulations/texas/28-Tex-Admin-Code-SS-13-492",
  "https://www.cima.ky/complaints-handling-and-regulatory-expectations",
]);
const HELD_REASON = {
  "https://www.law.cornell.edu/regulations/texas/28-Tex-Admin-Code-SS-13-492":
    "Quoted accurately but scoped to Health Care Collaboratives (Title 28, Chapter 13, Subchapter E), not to insurers. Read 17 August 2026.",
  "https://www.cima.ky/complaints-handling-and-regulatory-expectations":
    "Genuine CIMA complaints page, but contains no deadline provision, and the claims cite it for fixed procedural deadlines. Read 17 August 2026.",
};

// Labels come from the classifier's own vocabulary, never from here. I wrote
// my own map first and it said "Legal services" where the product says "Legal",
// which the label test caught. There is one place sector names live and this is
// not it.
const TAG_LABEL = JSON.parse(
  readFileSync("lib/exposure/vertical.ts", "utf8")
    .split("export const TAG_LABEL: Record<string, string> = ")[1]
    .split("};")[0]
    .replace(/(\w+):/g, '"$1":')
    .replace(/,\s*$/, "") + "}"
);

/** Stable key for a source, from its own citation rather than a counter. */
function sourceKey(vertical, src, i) {
  const base = (src.cite || src.title || `source-${i}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${vertical}-${base || `source-${i}`}`;
}

function main() {
  const pilot = JSON.parse(readFileSync(PILOT, "utf8"));
  const files = readdirSync(PROPOSED).filter((f) => f.endsWith(".json"));

  let merged = 0;
  let held = 0;
  let noop = 0;
  const heldRows = [];

  for (const file of files.sort()) {
    const vertical = file.replace(/\.json$/, "");
    const p = JSON.parse(readFileSync(path.join(PROPOSED, file), "utf8"));

    // The strongest class among the deltas citing each source. A source record
    // carries a class in this file and my first pass omitted it, which the
    // schema test caught: an entry without one is not a source, it is a URL.
    const bestClass = new Map();
    const ORDER = { A: 0, B: 1, D: 2, E: 3 };
    for (const caps of Object.values(p.deltas ?? {})) {
      for (const v of Object.values(caps)) {
        const cur = bestClass.get(v.source_url);
        if (cur === undefined || ORDER[v.class] < ORDER[cur]) {
          bestClass.set(v.source_url, v.class);
        }
      }
    }

    // Sources first, so a delta can reference one by key.
    const urlToKey = new Map();
    (p.evidence?.sources ?? []).forEach((src, i) => {
      if (HELD_SOURCES.has(src.url)) return;
      const key = sourceKey(vertical, src, i);
      urlToKey.set(src.url, key);
      pilot.sources[key] = {
        title: src.title,
        cite: src.cite ?? src.rule ?? null,
        url: src.url,
        class: bestClass.get(src.url) ?? "D",
      };
    });

    const deltas = {};
    for (const [role, caps] of Object.entries(p.deltas ?? {})) {
      for (const [cap, v] of Object.entries(caps)) {
        if (HELD_SOURCES.has(v.source_url)) {
          held += 1;
          heldRows.push({
            vertical,
            role,
            capability: cap,
            from: v.from,
            to: v.to,
            class: v.class,
            sourceUrl: v.source_url,
            heldBecause: HELD_REASON[v.source_url],
            why: v.why,
          });
          continue;
        }
        if (v.from === v.to) noop += 1;
        deltas[role] = deltas[role] ?? {};
        deltas[role][cap] = {
          from: v.from,
          to: v.to,
          class: v.class,
          // Keyed where the source is in the table, and kept as a raw URL
          // where it is not, so a claim never loses its citation to a lookup
          // that missed.
          source: urlToKey.get(v.source_url) ?? v.source_url,
          why: v.why,
        };
        merged += 1;
      }
    }

    if (Object.keys(deltas).length === 0) {
      console.log(`  ${vertical.padEnd(24)} nothing merged (all held)`);
      continue;
    }

    pilot.verticals[vertical] = {
      label: TAG_LABEL[vertical] ?? vertical.replace(/_/g, " "),
      regime: p.evidence?.regime ?? "",
      deltas,
    };
    const roles = Object.keys(deltas).length;
    const n = Object.values(deltas).reduce((a, c) => a + Object.keys(c).length, 0);
    console.log(`  ${vertical.padEnd(24)} ${roles} roles, ${n} deltas`);
  }

  // Coverage is stated in the file, not inferred by a reader. The lens tests
  // check that covered plus unresearched accounts for every sector the
  // classifier knows, so leaving this stale would claim sectors are unreached
  // that now have evidence.
  const covered = new Set(Object.keys(pilot.verticals));
  pilot.meta.verticalsResearched = covered.size;
  pilot.meta.verticalsUnresearched = Object.keys(TAG_LABEL)
    .filter((k) => !covered.has(k))
    .sort();

  pilot.meta.researched = new Date().toISOString().slice(0, 10);
  pilot.meta.roles = [
    ...new Set(
      Object.values(pilot.verticals).flatMap((v) => Object.keys(v.deltas ?? {}))
    ),
  ].sort();
  pilot.meta.method =
    "Six verticals hand-researched 6 August 2026 against named sources. Nine " +
    "added 17 August 2026 by scripts/research-role-verticals.mjs, search-first " +
    "and source-cited, merged by scripts/merge-role-verticals.mjs.";
  pilot.meta.held = {
    note:
      "Claims opened, read against their source, and found not to support what " +
      "they were cited for. Held rather than merged. Nothing here is a judgement " +
      "about the sector; each row names the source and what reading it showed.",
    rows: heldRows,
  };

  console.log("");
  console.log(`verticals in pilot   ${Object.keys(pilot.verticals).length}`);
  console.log(`deltas merged        ${merged}  (${noop} of them reaffirmations)`);
  console.log(`claims held          ${held}`);

  if (DRY) {
    console.log("\n--dry: nothing written");
    return;
  }
  writeFileSync(PILOT, JSON.stringify(pilot, null, 1) + "\n");
  console.log(`\nwrote ${PILOT}`);
}

main();
