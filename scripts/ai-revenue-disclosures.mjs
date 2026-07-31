// Finds quantified AI revenue statements in tracked vendors' SEC filings.
//
// AI revenue is never an XBRL-tagged line: no filer reports it as a segment,
// so it cannot be extracted structurally the way segment revenue can. But
// several filers DO state a figure in prose, inside filed documents that are
// signed and citable (10-K, 10-Q, and the 8-K exhibits carrying shareholder
// letters and CFO commentary).
//
// So this searches the filing full text, keeps only sentences that carry both
// an AI revenue phrase and a magnitude, and records the sentence verbatim with
// its filing URL. It never computes an AI figure. A vendor that states nothing
// comes back with nothing, which is the finding for most of them.

import { writeFileSync } from "node:fs";

const UA = "AI Enterprise demo research michael@talentgenius.io";
const SLEEP = 320;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CIKs must be zero-padded for the full-text endpoint; unpadded silently
// returns zero hits, which reads as "discloses nothing" and is wrong.
const VENDORS = [
  ["AMZN", "0001018724", "Amazon", "aws"],
  ["MSFT", "0000789019", "Microsoft", "microsoft"],
  ["GOOGL", "0001652044", "Alphabet", "google"],
  ["ORCL", "0001341439", "Oracle", "oracle"],
  ["IBM", "0000051143", "IBM", "ibm"],
  ["NVDA", "0001045810", "NVIDIA", "nvidia"],
  ["CRM", "0001108524", "Salesforce", "salesforce"],
  ["NOW", "0001373715", "ServiceNow", "servicenow"],
  ["META", "0001326801", "Meta Platforms", "meta"],
];

const QUERIES = [
  '"AI revenue"',
  '"AI annualized revenue run rate"',
  '"generative AI" "book of business"',
  '"AI-related revenue"',
];

// A sentence only counts if it carries a magnitude. "We are excited about AI
// revenue opportunities" is not a disclosure.
const MAGNITUDE = /\$\s?[\d.,]+\s*(billion|million|bn|m\b)|\b[\d.,]+\s*(billion|million)\b/i;
const AI_PHRASE = /\bAI revenue\b|\bgenerative AI\b[^.]{0,80}\bbook of business\b|\bbook of business\b[^.]{0,80}\bgenerative AI\b|\bAI-related revenue\b/i;

async function get(url, json = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  await sleep(SLEEP);
  if (!res.ok) throw new Error(`${res.status}`);
  return json ? res.json() : res.text();
}

async function search(query, cik) {
  const p = new URLSearchParams({ q: query, ciks: cik, forms: "10-K,10-Q,8-K" });
  try {
    const d = await get(
      `https://efts.sec.gov/LATEST/search-index?${p}`,
      true
    );
    return d?.hits?.hits ?? [];
  } catch {
    return [];
  }
}

function sentencesFrom(text) {
  return text.split(/(?<=[.!?])\s+/);
}

async function extract(hit, cik) {
  const [accRaw, doc] = hit._id.split(":");
  const acc = accRaw.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`;
  let text;
  try {
    const raw = await get(url);
    // Entities have to be decoded BEFORE any matching. These documents write
    // "$15&#160;billion", so a magnitude pattern looking for digits followed by
    // whitespace and "billion" fails on the literal entity text in between.
    text = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&nbsp;/g, " ")
      .replace(/&rsquo;|&lsquo;/g, "'")
      .replace(/&mdash;|&ndash;/g, "-")
      .replace(/&amp;/g, "&")
      // Zero-width and non-breaking characters are not \s in JS, so a phrase
      // like "AI<ZWSP> revenue" silently fails a \b...\b match.
      .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060]/g, " ")
      .replace(/\s+/g, " ");
  } catch {
    return [];
  }
  // Window around each match rather than sentence splitting: these documents
  // are shareholder letters and CFO commentary full of dashes, parentheses and
  // non-breaking punctuation, and a naive sentence split loses the very
  // statements worth quoting.
  const out = [];
  const finder = new RegExp(AI_PHRASE.source, "gi");
  let m;
  while ((m = finder.exec(text))) {
    const from = Math.max(0, m.index - 300);
    const to = Math.min(text.length, m.index + m[0].length + 300);
    let window = text.slice(from, to);
    if (!MAGNITUDE.test(window)) continue;

    // Trim to sentence boundaries where we can find them, so the quote reads
    // as a statement rather than a fragment.
    const startCut = window.search(/(?<=[.!?])\s+[A-Z(]/);
    if (startCut > 0 && startCut < 200) window = window.slice(startCut).trim();
    const endCut = window.lastIndexOf(". ");
    if (endCut > 80) window = window.slice(0, endCut + 1);

    out.push({
      statement: window.replace(/\s+/g, " ").trim(),
      form: hit._source?.file_type ?? null,
      filedAt: hit._source?.file_date ?? null,
      accession: accRaw,
      url,
    });
  }
  return out;
}

const results = [];
for (const [ticker, cik, name, vendorId] of VENDORS) {
  const seen = new Set();
  const statements = [];
  for (const q of QUERIES) {
    for (const hit of (await search(q, cik)).slice(0, 4)) {
      for (const st of await extract(hit, cik)) {
        const key = st.statement.slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        statements.push(st);
      }
    }
  }
  // Freshest first: the most recent filing is the operative figure.
  statements.sort((a, b) => (b.filedAt ?? "").localeCompare(a.filedAt ?? ""));
  results.push({
    ticker,
    name,
    vendorId,
    discloses: statements.length > 0,
    statements: statements.slice(0, 4),
  });
  console.error(
    `${ticker.padEnd(6)} ${statements.length ? `${statements.length} quantified statement(s), latest ${statements[0].filedAt}` : "no quantified AI revenue disclosure"}`
  );
}

writeFileSync(
  new URL("../fixtures/sec/ai-revenue-disclosures.json", import.meta.url),
  JSON.stringify(
    {
      provenance:
        "Quantified AI revenue statements found in the filers' own SEC filings (10-K, 10-Q and 8-K exhibits), quoted verbatim with the filing URL. No figure here is computed: AI revenue is not an XBRL-tagged line and cannot be extracted structurally.",
      source: "SEC EDGAR full-text search",
      capturedAt: new Date().toISOString().slice(0, 10),
      queries: QUERIES,
      vendors: results,
    },
    null,
    1
  )
);
console.error(
  `\n${results.filter((r) => r.discloses).length}/${results.length} vendors state a quantified AI revenue figure`
);
