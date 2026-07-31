// Extracts reported business-segment revenue from SEC XBRL filings.
//
// Why parse the filing instance rather than the JSON API: SEC's
// companyconcept/companyfacts endpoints return consolidated facts only. They
// strip the dimensional context, so segment breakouts are simply not in them.
// The segment split lives in the filing's own XBRL instance, where each fact
// points at a context and the context carries an explicitMember on the
// business-segments axis.
//
// What this produces is REPORTED SEGMENT REVENUE, which is audited and
// citable. It is emphatically not AI revenue: AWS is overwhelmingly non-AI
// cloud, and no filer in this set breaks out an AI line. The consuming UI
// has to say so.
//
// Usage: node scripts/segment-revenue.mjs > fixtures/sec/segment-revenue.json

import { writeFileSync } from "node:fs";

const UA = "AI Enterprise demo research michael@talentgenius.io";
const SLEEP_MS = 260; // SEC asks for <= 10 req/s; stay well under.

// Tickers are the listed companies in the TRACKED AI VENDOR SET, and nothing
// else. The set is the ranking engine's own taxonomy, not a judgement made
// here: every entry below resolves to a tracked vendor with a market category.
//
// Deliberately absent: Accenture, Adobe, Cisco, Dell. None is a tracked AI
// vendor. Accenture in particular is a systems integrator, the delivery
// channel rather than an AI vendor, and it reports geographic segments
// (Americas, EMEA, Asia Pacific) that say nothing about AI even in principle.
// Including it put the channel back inside AI vendor analysis, which is the
// exact confusion the rest of this app works to prevent.
const TICKERS = [
  ["AMZN", "0001018724", "Amazon", "aws", "Cloud AI platform"],
  ["MSFT", "0000789019", "Microsoft", "microsoft", "Cloud AI platform"],
  ["GOOGL", "0001652044", "Alphabet", "google", "Cloud AI platform"],
  ["ORCL", "0001341439", "Oracle", "oracle", "Cloud AI platform"],
  ["IBM", "0000051143", "IBM", "ibm", "Regulated-industry AI"],
  ["NVDA", "0001045810", "NVIDIA", "nvidia", "AI infrastructure"],
  ["CRM", "0001108524", "Salesforce", "salesforce", "CRM/customer AI"],
  ["NOW", "0001373715", "ServiceNow", "servicenow", "ITSM/HR/service AI"],
  ["META", "0001326801", "Meta Platforms", "meta", "Frontier model/API"],
];

// Revenue concepts filers actually use, best first. Filers are not
// consistent: Adobe and NVIDIA tag segment revenue as plain Revenues, while
// Oracle uses its own extension concepts (CloudRevenues, SoftwareRevenues,
// HardwareRevenues) with no standard equivalent, so those are matched by
// shape rather than by an exhaustive list.
const REVENUE_TAGS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "SalesRevenueServicesNet",
];

// Fallback for filer-specific extensions: any element whose local name ends
// in "Revenues" and is not a text block, policy or rollforward concept.
const EXT_REVENUE_RE =
  /<(?:[\w-]+:)?(\w*Revenues)\b(?![\w])[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)</g;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asText = true) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await sleep(SLEEP_MS);
  return asText ? res.text() : res.json();
}

// Most recent annual report; falls back to the latest quarterly if a filer
// has no 10-K in the recent window (foreign issuers file 20-F).
async function latestFiling(cik) {
  const subs = await get(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    false
  );
  const r = subs.filings.recent;
  const order = ["10-K", "20-F", "10-Q"];
  for (const form of order) {
    const i = r.form.indexOf(form);
    if (i !== -1) {
      return {
        form: r.form[i],
        accession: r.accessionNumber[i].replace(/-/g, ""),
        filed: r.filingDate[i],
        period: r.reportDate[i],
        entity: subs.name,
        fiscalYearEnd: subs.fiscalYearEnd,
      };
    }
  }
  return null;
}

async function instanceUrl(cik, accession) {
  const bare = String(Number(cik));
  const base = `https://www.sec.gov/Archives/edgar/data/${bare}/${accession}`;
  const idx = await get(`${base}/index.json`, false);
  const names = idx.directory.item.map((i) => i.name);
  // The inline-XBRL instance is <ticker>-<date>_htm.xml.
  const inst =
    names.find((n) => n.endsWith("_htm.xml")) ??
    names.find((n) => n.endsWith(".xml") && !n.includes("_cal") && !n.includes("_def") && !n.includes("_lab") && !n.includes("_pre") && !n.includes("FilingSummary"));
  return inst ? { url: `${base}/${inst}`, base } : null;
}

const SEG_AXIS = /SegmentsAxis|ReportableSegment/i;
const QUALIFIER_AXIS = /ConsolidationItemsAxis/i;
const QUALIFIER_MEMBER = /OperatingSegmentsMember|ReportableSegmentsMember/i;

// Contexts that carry exactly one business-segment member.
// A context with extra axes (geography, product line) is a finer cut and
// would double-count against the segment total, so it is skipped.
function parseSegmentContexts(xml) {
  const out = new Map();
  const re = /<(?:[\w-]+:)?context id="([^"]+)"[\s\S]*?<\/(?:[\w-]+:)?context>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [block, id] = [m[0], m[1]];
    const members = [
      ...block.matchAll(
        /<(?:[\w-]+:)?explicitMember dimension="([^"]+)"[^>]*>([^<]+)</g
      ),
    ];

    // Exactly one member on a business-segments axis.
    const segs = members.filter((m) => SEG_AXIS.test(m[1]));
    if (segs.length !== 1) continue;
    const [, axis, member] = segs[0];

    // The canonical tagging pairs the segment with a consolidation-items
    // qualifier (us-gaap:OperatingSegmentsMember), which is not a finer cut
    // and must not disqualify the context. Anything else on the context IS a
    // finer cut (geography, product line, a restructuring programme) and
    // would double-count against the segment total, so it is skipped.
    const others = members.filter((m) => m !== segs[0]);
    const harmless = others.every(
      (m) => QUALIFIER_AXIS.test(m[1]) && QUALIFIER_MEMBER.test(m[2])
    );
    if (!harmless) continue;

    // Duration contexts only: revenue is a flow, not a balance.
    const start = block.match(/<(?:[\w-]+:)?startDate>([^<]+)</)?.[1];
    const end = block.match(/<(?:[\w-]+:)?endDate>([^<]+)</)?.[1];
    if (!start || !end) continue;
    out.set(id, { axis, member: member.trim(), start, end });
  }
  return out;
}

function prettyMember(member) {
  // amzn:AmazonWebServicesSegmentMember -> Amazon Web Services
  const raw = member.includes(":") ? member.split(":")[1] : member;
  return raw
    .replace(/Member$/, "")
    .replace(/Segment$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFacts(xml, contexts, tag) {
  const rows = [];
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)<`,
    "g"
  );
  let m;
  while ((m = re.exec(xml))) {
    const ctx = contexts.get(m[1]);
    if (!ctx) continue;
    const scaleM = /decimals="(-?\d+)"/.exec(m[0]);
    const raw = m[2].replace(/,/g, "").trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) continue;
    rows.push({
      contextRef: m[1],
      member: ctx.member,
      label: prettyMember(ctx.member),
      start: ctx.start,
      end: ctx.end,
      value: Number(raw),
      decimals: scaleM ? Number(scaleM[1]) : null,
    });
  }
  return rows;
}

async function forTicker(ticker, cik, name, vendorId, category) {
  const filing = await latestFiling(cik);
  if (!filing) return { ticker, name, vendorId, category, error: "no filing found" };

  const inst = await instanceUrl(cik, filing.accession);
  if (!inst) return { ticker, name, vendorId, category, error: "no XBRL instance in filing" };

  const xml = await get(inst.url);
  const contexts = parseSegmentContexts(xml);
  if (contexts.size === 0) {
    // Distinguish a real disclosure fact from a parser limitation. A filer
    // with no business-segments axis anywhere in its instance reports as one
    // segment; that is the company's own disclosure, not a gap here.
    const hasAxis = SEG_AXIS.test(xml);
    return {
      ticker,
      name,
      vendorId,
      category,
      form: filing.form,
      singleSegment: !hasAxis,
      error: hasAxis
        ? "segment axis present but no usable single-segment contexts"
        : "reports as a single segment: no segment breakout is disclosed",
    };
  }

  let rows = [];
  let usedTag = null;
  for (const tag of REVENUE_TAGS) {
    rows = parseFacts(xml, contexts, tag);
    if (rows.length) {
      usedTag = tag;
      break;
    }
  }
  if (!rows.length) {
    // Extension-concept pass: collect every *Revenues element sitting in a
    // segment context, then keep only the concept with the widest segment
    // coverage so one filer-specific line does not stand in for the split.
    const byConcept = new Map();
    let m;
    EXT_REVENUE_RE.lastIndex = 0;
    while ((m = EXT_REVENUE_RE.exec(xml))) {
      const [, concept, ref, raw] = m;
      if (/TextBlock|Policy|Abstract|Table/i.test(concept)) continue;
      const ctx = contexts.get(ref);
      if (!ctx) continue;
      const val = raw.replace(/,/g, "").trim();
      if (!/^-?\d+(\.\d+)?$/.test(val)) continue;
      const list = byConcept.get(concept) ?? [];
      list.push({
        contextRef: ref,
        member: ctx.member,
        label: prettyMember(ctx.member),
        start: ctx.start,
        end: ctx.end,
        value: Number(val),
      });
      byConcept.set(concept, list);
    }
    let best = null;
    for (const [concept, list] of byConcept) {
      const segs = new Set(list.map((r) => r.member)).size;
      if (!best || segs > best.segs) best = { concept, list, segs };
    }
    if (best && best.segs > 1) {
      rows = best.list;
      usedTag = best.concept + " (filer extension)";
    }
  }

  if (!rows.length) {
    return { ticker, name, vendorId, category, form: filing.form, error: "no segment revenue facts" };
  }

  // Keep the longest period ending on the report date: the full fiscal year
  // rather than a stub quarter also present in the same filing.
  const days = (r) =>
    (new Date(r.end) - new Date(r.start)) / 86_400_000;
  const maxDays = Math.max(...rows.map(days));
  const period = rows.filter((r) => days(r) > maxDays - 20);
  const end = period.reduce((a, r) => (r.end > a ? r.end : a), "");
  const chosen = period.filter((r) => r.end === end);

  // Deduplicate: same member can appear more than once in a filing.
  const bySeg = new Map();
  for (const r of chosen) {
    const held = bySeg.get(r.member);
    if (!held || r.value > held.value) bySeg.set(r.member, r);
  }

  const segments = [...bySeg.values()]
    .map((r) => ({ segment: r.label, member: r.member, revenueUsd: r.value }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);

  const total = segments.reduce((a, s) => a + s.revenueUsd, 0);

  return {
    ticker,
    name,
    vendorId,
    category,
    entity: filing.entity,
    form: filing.form,
    accession: filing.accession,
    filingDate: filing.filed,
    periodStart: chosen[0]?.start ?? null,
    periodEnd: end,
    concept: usedTag,
    filingUrl: inst.url,
    segments: segments.map((s) => ({
      ...s,
      sharePct: total ? Math.round((s.revenueUsd / total) * 1000) / 10 : null,
    })),
    segmentTotalUsd: total,
  };
}

const results = [];
for (const [t, cik, name, vid, cat] of TICKERS) {
  try {
    const r = await forTicker(t, cik, name, vid, cat);
    results.push(r);
    console.error(
      `${t.padEnd(6)} ${r.error ? "ERR  " + r.error : `${r.segments.length} segments, ${r.form} ${r.periodEnd}`}`
    );
  } catch (e) {
    results.push({ ticker: t, name, vendorId: vid, category: cat, error: String(e).slice(0, 120) });
    console.error(`${t.padEnd(6)} EXC  ${String(e).slice(0, 90)}`);
  }
}

const payload = {
  provenance:
    "Reported business-segment revenue parsed from each filer's own SEC XBRL filing instance. Audited figures as filed. NOT AI revenue: no filer in this set discloses an AI revenue line.",
  source: "SEC EDGAR",
  capturedAt: new Date().toISOString().slice(0, 10),
  companies: results,
};
writeFileSync(
  new URL("../fixtures/sec/segment-revenue.json", import.meta.url),
  JSON.stringify(payload, null, 1)
);
console.error(`\nwrote ${results.filter((r) => !r.error).length}/${results.length} companies`);
