// Audit the cited-findings corpus and the retriever that reads it.
//
// WHY THIS EXISTS. A cited finding is the one output in this product where a
// wrong answer is indistinguishable from a right one: it is fluent, it names a
// real vendor, it carries a source, and a buyer acts on it. The guards already
// in place (no invented figure, no invented vendor name) all check the model's
// OUTPUT. Nothing checked the evidence going IN. This checks the evidence.
//
// Read-only. Writes nothing, changes nothing. Prints anomalies and exits
// non-zero if any are structural.
//
// Usage:  npx tsx scripts/audit-cited-findings.ts

import { citedChunks } from "@/lib/desk/corpus";
import { DEPRECATIONS } from "@/lib/desk/deprecations";
import { ENCROACHMENTS } from "@/lib/desk/encroachment";
import { SHIELD } from "@/lib/shield/data";
import { retrieve } from "@/app/api/analyst/lib";
import type { Chunk } from "@/app/api/analyst/lib";

const TODAY = process.env.AUDIT_TODAY || new Date().toISOString().slice(0, 10);

// Realistic buyer situations: the four the page itself offers, plus the
// questions this corpus was specifically built to be able to answer.
const SITUATIONS = [
  "We are a European bank exploring agentic AI for client onboarding, worried about the EU AI Act.",
  "Global manufacturer, 60,000 staff, choosing between Copilot and a frontier lab API for engineering.",
  "Public sector body needing data residency and a defensible vendor decision for a citizen assistant.",
  "Energy company piloting maintenance AI; the board wants to know who delivers it and what it costs.",
  "Can OpenAI train on our data?",
  "Which models are being retired and when do our calls start failing?",
  "Who indemnifies us if the output infringes copyright?",
  "We need UK data residency for a healthcare assistant.",
  "Our supplier also competes with us. Where is that happening in the AI stack?",
  "Which vendor should we shortlist for a regulated insurance workflow?",
];

type Level = "ERROR" | "WARN" | "INFO";
const anomalies: { level: Level; area: string; msg: string; detail?: string }[] = [];
const add = (level: Level, area: string, msg: string, detail?: string) =>
  anomalies.push({ level, area, msg, detail });

function main() {
  const cited = citedChunks();
  // The retriever wants Chunk, which carries a sourceKind. Cited material is
  // all one kind, so the boost is uniform and the ranking is pure term overlap.
  const chunks: Chunk[] = cited.map((c) => ({
    source: c.source,
    sourceKind: "cited",
    text: c.text,
  }));

  console.log(`corpus            ${chunks.length} cited chunks`);
  console.log(`  shield vendors  ${SHIELD.length}`);
  console.log(`  deprecations    ${DEPRECATIONS.length}`);
  console.log(`  encroachments   ${ENCROACHMENTS.length}`);
  console.log(`  today           ${TODAY}`);
  console.log("");

  // ---- 1. Structure: every chunk needs a source and usable text ----------
  for (const c of chunks) {
    if (!c.source?.trim()) add("ERROR", "sources", "chunk with an empty source", c.text.slice(0, 90));
    if (!c.text || c.text.trim().length < 20) add("ERROR", "text", "chunk with no usable text", JSON.stringify(c));
  }
  const noReceipt = chunks.filter((c) => /no receipt obtained/i.test(c.source));
  if (noReceipt.length) {
    add("INFO", "sources", `${noReceipt.length} chunks carry the explicit no-receipt source`,
      "The honest-absence path working, not a defect. Counted so it stays visible.");
  }

  // ---- 2. House rule: no em-dash anywhere -------------------------------
  for (const c of chunks) {
    if (c.text.includes("—")) add("ERROR", "house-rule", "em-dash in a cited chunk", c.text.slice(0, 110));
  }

  // ---- 3. Deprecations: a past retirement stated as future is a lie -----
  for (const d of DEPRECATIONS) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.retire)) {
      add("ERROR", "deprecations", `retire date is not ISO: ${d.model} = ${d.retire}`);
      continue;
    }
    if (!d.source?.url) add("ERROR", "deprecations", `no source URL: ${d.vendor} ${d.model}`);
    if (d.retire < TODAY) {
      // The test is the TENSE, not the presence. A past retirement belongs in
      // the corpus, said in the past tense: a buyer still calling a dead model
      // needs that more urgently than one facing a deadline. What must never
      // appear is a past date described as something that has yet to happen.
      const futureTense = chunks.some(
        (c) =>
          c.text.includes(d.model) &&
          /\bis retiring\b|\bwill retire\b|After that date, calls to it fail/.test(c.text)
      );
      if (futureTense) {
        add("ERROR", "deprecations",
          `already-retired model stated in the future tense: ${d.vendor} ${d.model}`,
          `retire ${d.retire} is before today ${TODAY}, yet the chunk reads as a future event.`);
      }
      const present = chunks.some((c) => c.text.includes(d.model));
      if (!present) {
        add("WARN", "deprecations",
          `past retirement dropped from the corpus entirely: ${d.vendor} ${d.model}`,
          "A buyer still calling it gets no warning at all.");
      }
    }
  }

  // ---- 4. Encroachments: dated primary receipt required ------------------
  for (const e of ENCROACHMENTS) {
    if (!e.source?.url) add("ERROR", "encroachment", `no source URL: ${e.actor} vs ${e.against}`);
    // Format-agnostic on purpose. This module stamps a human date ("4 Dec
    // 2025") and nothing sorts or compares it, so demanding ISO here would be
    // the audit inventing a rule the code never made. What must hold is that
    // the date parses and is not in the future: a receipt cannot postdate the
    // claim it supports.
    const parsed = Date.parse(e.date ?? "");
    if (Number.isNaN(parsed)) {
      add("ERROR", "encroachment", `date does not parse: ${e.actor} vs ${e.against}`, String(e.date));
    } else if (parsed > Date.parse(TODAY)) {
      add("ERROR", "encroachment", `receipt dated in the future: ${e.actor}`, e.date);
    }
    if (!e.fact || e.fact.length < 20) {
      add("WARN", "encroachment", `fact too thin to quote: ${e.actor} vs ${e.against}`, e.fact);
    }
  }

  // ---- 5. Duplicate chunk text -------------------------------------------
  const seen = new Map<string, string>();
  for (const c of chunks) {
    const key = c.text.trim().toLowerCase();
    if (seen.has(key)) {
      add("WARN", "duplicates", "identical chunk text from two sources", `${seen.get(key)} | ${c.source}`);
    } else seen.set(key, c.source);
  }

  // ---- 6. Reach: how much of the corpus any realistic question can see ---
  const everRetrieved = new Set<string>();
  for (const s of SITUATIONS) for (const h of retrieve(chunks, s, 8)) everRetrieved.add(h.chunk.text);
  add("INFO", "retrieval",
    `${everRetrieved.size} of ${chunks.length} chunks reachable across the ten test situations`,
    "Low reach is expected and correct: the corpus spans 40+ vendors, each situation names one or two.");

  // ---- 7. Pointed question must get a pointed chunk ----------------------
  const EXPECT: [string, RegExp, string][] = [
    ["Can OpenAI train on our data?", /openai/i, "an OpenAI chunk"],
    ["Which models are being retired and when do our calls start failing?", /retiring the model/i, "a deprecation chunk"],
    ["Who indemnifies us if the output infringes copyright?", /indemnif/i, "an indemnity chunk"],
    ["Our supplier also competes with us. Where is that happening in the AI stack?", /encroachment/i, "an encroachment chunk"],
    ["We need UK data residency for a healthcare assistant.", /residency|sovereignty/i, "a residency or sovereignty chunk"],
  ];
  for (const [q, pattern, want] of EXPECT) {
    const hits = retrieve(chunks, q, 8);
    if (hits.length === 0) {
      add("WARN", "retrieval", `nothing retrieved at all for: "${q}"`);
      continue;
    }
    if (!hits.some((h) => pattern.test(h.chunk.text))) {
      add("WARN", "retrieval", `top 8 for "${q}" contains no ${want}`,
        hits.slice(0, 3).map((h) => h.chunk.text.slice(0, 70)).join(" || "));
    }
  }

  // ---- 8. Can the corpus support naming three vendors? -------------------
  // The finding is being changed to recommend three. If retrieval only ever
  // surfaces one or two distinct vendors, that promise cannot be kept honestly.
  for (const s of SITUATIONS) {
    const hits = retrieve(chunks, s, 8);
    const names = new Set<string>();
    for (const h of hits) {
      const m = h.chunk.text.match(/^([A-Z][A-Za-z0-9&.\- ]{2,28}?)(?:,| is | sovereignty)/);
      if (m) names.add(m[1].trim());
    }
    if (hits.length > 0 && names.size < 3) {
      add("WARN", "three-vendors", `only ${names.size} distinct vendor(s) retrievable`,
        `"${s.slice(0, 62)}" -> ${[...names].join(", ") || "none parsed"}`);
    }
  }

  // ---- report -------------------------------------------------------------
  const errors = anomalies.filter((a) => a.level === "ERROR");
  const warns = anomalies.filter((a) => a.level === "WARN");
  const infos = anomalies.filter((a) => a.level === "INFO");
  for (const a of [...errors, ...warns, ...infos]) {
    console.log(`${a.level.padEnd(5)} [${a.area}] ${a.msg}`);
    if (a.detail) console.log(`      ${a.detail}`);
  }
  console.log("");
  console.log(`${errors.length} errors, ${warns.length} warnings, ${infos.length} notes`);
  process.exit(errors.length ? 1 : 0);
}

main();
