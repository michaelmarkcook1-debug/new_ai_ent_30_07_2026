#!/usr/bin/env node
// Refresh the committed adoption snapshot.
//
//     npm run ingest:adoption
//
// Writes data/adoption/disclosure-10-K.json, which the API serves when the
// live EDGAR call cannot be made: on a cold start, behind a firewall, or
// when the SEC is rate-limiting. Committing the result is deliberate: the
// Vercel filesystem is read-only at runtime, so a snapshot that ships with
// the deploy is the only fallback that survives one.
//
// The script deliberately duplicates a little of lib/adoption rather than
// importing it: this repo has no TypeScript runner in its dependencies, and
// adding one to run an eight-request script would be the wrong trade. The
// shapes are asserted against the TypeScript types by
// tests/adoption-ingest.test.ts, so a drift between the two fails the suite
// rather than going unnoticed.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const EFTS = "https://efts.sec.gov/LATEST/search-index";
const OUT_DIR = path.join(process.cwd(), "data", "adoption");
const FORM = process.argv[2] ?? "10-K";
const THROTTLE_MS = 250;
// Twelve months: EDGAR indexes back to 2001, and an unbounded count measures
// "ever mentioned" rather than "named in a current annual report".
const WINDOW_DAYS = 365;

const TRACKED = [
  { vendor: "OpenAI", term: "OpenAI" },
  { vendor: "Anthropic", term: "Anthropic" },
  { vendor: "Google Cloud", term: "Google Cloud" },
  { vendor: "Microsoft Azure", term: "Microsoft Azure" },
  { vendor: "Databricks", term: "Databricks" },
  { vendor: "Palantir", term: "Palantir" },
  { vendor: "Snowflake", term: "Snowflake" },
  { vendor: "Hugging Face", term: "Hugging Face" },
];

const SIC_LABELS = {
  "7372": "Prepackaged software",
  "7370": "Computer services",
  "7371": "Computer programming services",
  "7374": "Data processing and hosting",
  "7389": "Business services",
  "6770": "Blank cheques and holding companies",
  "6199": "Finance services",
  "6022": "State commercial banks",
  "6021": "National commercial banks",
  "5961": "Retail, catalogue and mail-order",
  "3674": "Semiconductors",
  "2836": "Biological products",
  "2834": "Pharmaceutical preparations",
  "8742": "Management consulting",
  "4813": "Telecommunications",
  "6324": "Hospital and medical service plans",
  "3841": "Surgical and medical instruments",
  "7812": "Motion picture and video production",
  "6798": "Real estate investment trusts",
  "4911": "Electric services",
};

const UA = process.env.SEC_USER_AGENT ?? "AI-Enterprise-Demo (contact: set SEC_USER_AGENT)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function filingUrl(id, cik) {
  const [accession, file] = String(id).split(":");
  if (!accession) return "";
  return `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, "")}/${accession.replace(/-/g, "")}/${file ?? ""}`;
}

const FROM = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
const TO = new Date().toISOString().slice(0, 10);

async function one(term, vendor) {
  const url = `${EFTS}?q=${encodeURIComponent(`"${term}"`)}&forms=${encodeURIComponent(FORM)}&startdt=${FROM}&enddt=${TO}`;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const hits = body?.hits?.hits ?? [];
  return {
    vendor,
    filings: body?.hits?.total?.value ?? 0,
    bySic: (body?.aggregations?.sic_filter?.buckets ?? []).slice(0, 8).map((b) => ({
      sic: b.key,
      label: SIC_LABELS[b.key] ?? `SIC ${b.key}`,
      filings: b.doc_count,
    })),
    examples: hits.slice(0, 5).map((h) => {
      const cik = h._source?.ciks?.[0] ?? "";
      return {
        company: String(h._source?.display_names?.[0] ?? "Unknown").replace(/\s{2,}/g, " "),
        cik,
        filedOn: h._source?.file_date ?? "",
        sic: h._source?.sics?.[0] ?? "",
        url: filingUrl(h._id, cik),
      };
    }),
    query: `"${term}" in ${FORM}, filed ${FROM} to ${TO}`,
  };
}

async function main() {
  const rows = [];
  const failed = [];
  console.log(`Ingesting ${TRACKED.length} vendors from SEC EDGAR (${FORM}, ${FROM} to ${TO})…`);
  for (const [i, v] of TRACKED.entries()) {
    if (i > 0) await sleep(THROTTLE_MS);
    try {
      const row = await one(v.term, v.vendor);
      rows.push(row);
      console.log(`  ${v.vendor.padEnd(16)} ${String(row.filings).padStart(5)} filings`);
    } catch (e) {
      failed.push({ vendor: v.vendor, reason: String(e.message ?? e) });
      console.log(`  ${v.vendor.padEnd(16)}  FAILED: ${e.message ?? e}`);
    }
  }

  if (rows.length === 0) {
    console.error("Every vendor failed; refusing to overwrite the snapshot with nothing.");
    process.exit(1);
  }

  rows.sort((a, b) => b.filings - a.filings);
  const snapshot = {
    measures:
      "Registrants naming each vendor in the stated SEC filing type, within the stated window. A count of disclosures, not of customers and not market share.",
    formType: FORM,
    window: `last ${WINDOW_DAYS} days`,
    fetchedAt: new Date().toISOString(),
    rows,
    failed,
    source: {
      id: "sec_edgar_fts",
      name: "SEC EDGAR full-text search",
      homepage: "https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22",
      apiDocs: "https://www.sec.gov/edgar/search/efts-faq.html",
      requiresKey: false,
      envVars: ["SEC_USER_AGENT"],
      evidenceClass: "A",
      measures:
        "How many SEC registrants name a vendor in a given filing type, with the industry (SIC) and filing date of each.",
      cannotSupport:
        "Whether the registrant is a customer. A filing may name a vendor as a competitor, investor, supplier or partner, and does not say which. It is also US registrants only, so private and non-US adoption is invisible.",
      licence:
        "US government work, public domain. SEC fair-access policy requires a declared User-Agent and asks for under 10 requests per second.",
    },
  };

  await mkdir(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `disclosure-${FORM}.json`);
  await writeFile(out, `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(
    `\nWrote ${path.relative(process.cwd(), out)}: ${rows.length} vendors, ${failed.length} failed.`
  );
  if (failed.length) console.log("Failures are recorded in the snapshot, not hidden.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
