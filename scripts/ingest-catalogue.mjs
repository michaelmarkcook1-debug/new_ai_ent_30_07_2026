#!/usr/bin/env node
// Ingest the movement catalogue.
//
//     npm run ingest:catalogue          all series
//     npm run ingest:catalogue model    one series
//
// Writes observations to Postgres. Needs SUPABASE_SERVICE_ROLE_KEY, because
// anonymous callers may read the catalogue and may not write to it — that
// asymmetry is the point of the row-level security, so the ingestion is the
// one thing that holds a privileged key.
//
//     npm run ingest:catalogue -- --sql > catalogue.sql
//
// emits the INSERT statements instead of sending them, for pasting into the
// Supabase SQL editor. Same rows, no key needed, and it makes the write
// reviewable before it happens.
//
// What "movement" means differs by series, and the script does not pretend
// otherwise:
//
//   vendor  Genuinely moves today. SEC EDGAR is queried for two consecutive
//           twelve-month windows, so the first run already yields a real
//           before-and-after rather than a baseline.
//   model   One observation per run from the catalogue snapshot. Movement
//           appears on the second run, or sooner where a vendor's published
//           price differs from the snapshot's.
//   market  One observation per refresh of the AIE estimate.
//   finance Reported revenue and valuation figures for the private AI
//           companies, read from lib/finance/data/private-figures.json —
//           the same file the financial snapshot serves. Each record is
//           already dated by its citation, so the series carries real
//           movement as soon as two dated figures exist for a vendor.
//   usage   Not ingested. It accumulates from the app as people use it.

import { readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://lmptnwqthldbficddtfn.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = process.env.SEC_USER_AGENT ?? "AI-Enterprise-Demo (contact: set SEC_USER_AGENT)";
const EFTS = "https://efts.sec.gov/LATEST/search-index";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TRACKED = [
  { vendor: "OpenAI", term: "OpenAI", id: "openai" },
  { vendor: "Anthropic", term: "Anthropic", id: "anthropic" },
  { vendor: "Google Cloud", term: "Google Cloud", id: "google" },
  { vendor: "Microsoft Azure", term: "Microsoft Azure", id: "microsoft" },
  { vendor: "Databricks", term: "Databricks", id: "databricks" },
  { vendor: "Palantir", term: "Palantir", id: "palantir" },
  { vendor: "Snowflake", term: "Snowflake", id: "snowflake" },
  { vendor: "Hugging Face", term: "Hugging Face", id: "huggingface" },
];

// ── Postgres over PostgREST ────────────────────────────────────────────────

async function post(pathAndQuery, body, extraHeaders = {}) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/${pathAndQuery}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      "accept-profile": "aie",
      "content-profile": "aie",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 201 || res.status === 200 ? res : res;
}

/**
 * Write observations, ignoring ones already recorded.
 *
 * `resolution=ignore-duplicates` against the (series, subject, metric,
 * observed_at) unique constraint makes a re-run idempotent: running the
 * ingestion twice in a day adds nothing the second time rather than
 * double-counting the same fact.
 */
async function writeObservations(rows) {
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += 500) {
    await post("observation", rows.slice(i, i + 500), {
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
  }
  return rows.length;
}

async function writeRun(series, attempted, written, failures, note) {
  await post("ingestion_run", [
    {
      series,
      finished_at: new Date().toISOString(),
      ok: failures.length === 0,
      attempted,
      rows_written: written,
      failures,
      note,
    },
  ], { prefer: "return=minimal" });
}

// ── model series ───────────────────────────────────────────────────────────

function ingestModels() {
  const file = path.join(process.cwd(), "lib", "model-fit", "data", "models.json");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const models = Array.isArray(raw) ? raw : (raw.models ?? []);

  // The snapshot was copied on 2 August 2026 and is a snapshot, not a feed —
  // so observed_at is that date, not today. Recording it as today would claim
  // the prices were verified today, which they were not.
  const observedAt = "2026-08-02T00:00:00Z";
  const rows = [];

  for (const m of models) {
    const id = m.model_id;
    if (!id) continue;
    const common = {
      series: "model",
      subject_kind: "model",
      subject_id: id,
      subject_label: id,
      observed_at: observedAt,
      source_id: "aie_model_catalogue",
      vintage: "catalogue snapshot, 2 August 2026",
      provenance:
        "AI Enterprise model catalogue snapshot of 2 August 2026, assembled from vendor pricing pages and model cards. A snapshot, not a feed.",
    };

    if (typeof m.cost_input_per_1m === "number") {
      rows.push({ ...common, metric: "input_price_per_mtok", value_num: m.cost_input_per_1m, unit: "USD per million tokens" });
    }
    if (typeof m.cost_output_per_1m === "number") {
      rows.push({ ...common, metric: "output_price_per_mtok", value_num: m.cost_output_per_1m, unit: "USD per million tokens" });
    }
    if (typeof m.throughput_tokens_per_sec === "number") {
      rows.push({ ...common, metric: "throughput_tps", value_num: m.throughput_tokens_per_sec, unit: "tokens per second" });
    }
    const intel = m.benchmarks?.intelligence;
    if (typeof intel === "number") {
      rows.push({ ...common, metric: "intelligence", value_num: intel, unit: "index" });
    }
    if (typeof m.context_window_tokens === "number") {
      rows.push({ ...common, metric: "context_window", value_num: m.context_window_tokens, unit: "tokens" });
    }
    if (m.vendor) {
      rows.push({ ...common, metric: "vendor", value_text: m.vendor, value_num: null });
    }
  }
  return { rows, attempted: models.length, failures: [] };
}

// ── vendor series (SEC disclosure, two windows) ────────────────────────────

async function secCount(term, from, to) {
  const url =
    `${EFTS}?q=${encodeURIComponent(`"${term}"`)}&forms=10-K` +
    `&startdt=${from}&enddt=${to}`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(`expected JSON, got ${type || "nothing"}`);
  const body = await res.json();
  return body?.hits?.total?.value ?? 0;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function ingestVendors() {
  // Two consecutive twelve-month windows. The earlier window's observation is
  // dated at its own end, not today, so the pair reads as a real before and
  // after rather than two readings taken at the same instant.
  const now = isoDaysAgo(0);
  const oneYear = isoDaysAgo(365);
  const twoYears = isoDaysAgo(730);
  const windows = [
    { from: twoYears, to: oneYear, observedAt: `${oneYear}T00:00:00Z`, label: "prior twelve months" },
    { from: oneYear, to: now, observedAt: `${now}T00:00:00Z`, label: "last twelve months" },
  ];

  const rows = [];
  const failures = [];
  for (const w of windows) {
    for (const [i, v] of TRACKED.entries()) {
      if (i > 0) await sleep(250);
      try {
        const count = await secCount(v.term, w.from, w.to);
        rows.push({
          series: "vendor",
          subject_kind: "vendor",
          subject_id: v.id,
          subject_label: v.vendor,
          metric: "disclosure_filings_10k",
          value_num: count,
          unit: "filings",
          observed_at: w.observedAt,
          source_id: "sec_edgar_fts",
          vintage: `10-K filings, ${w.from} to ${w.to}`,
          provenance:
            `Registrants naming "${v.term}" in a 10-K filed between ${w.from} and ${w.to}, ` +
            `counted by SEC EDGAR full-text search. A count of disclosures, not of customers, and not market share.`,
        });
        console.log(`  ${v.vendor.padEnd(16)} ${w.label.padEnd(22)} ${String(count).padStart(4)}`);
      } catch (e) {
        failures.push({ subject: `${v.vendor} (${w.label})`, reason: String(e.message ?? e) });
        console.log(`  ${v.vendor.padEnd(16)} ${w.label.padEnd(22)} FAILED: ${e.message ?? e}`);
      }
    }
  }
  return { rows, attempted: TRACKED.length * windows.length, failures };
}

// ── market series ──────────────────────────────────────────────────────────

function ingestMarket() {
  const file = path.join(process.cwd(), "fixtures", "aie-live", "market-share.json");
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { rows: [], attempted: 0, failures: [{ subject: "market-share", reason: String(e.message ?? e) }] };
  }
  const estimates = raw.estimates ?? [];
  const observedAt = raw.asOf ?? new Date().toISOString();
  const rows = [];
  for (const e of estimates) {
    if (typeof e.estimatedShare !== "number") continue;
    rows.push({
      series: "market",
      subject_kind: "category",
      subject_id: `${e.vendorId}::${e.categoryId ?? "all"}`,
      subject_label: `${e.vendorId} in ${e.categoryId ?? "all categories"}`,
      metric: "category_share_pct",
      value_num: e.estimatedShare,
      unit: "per cent",
      observed_at: e.sourceDate ?? observedAt,
      source_id: "aie_market_share",
      vintage: `${raw.label ?? "AIE category share estimate"}, confidence ${e.confidence ?? "unstated"}`,
      // Each row carries its own source and methodology upstream, and those
      // are more specific than the dataset-level string — so the row's own
      // wording is what travels with the figure.
      provenance: [e.source, e.methodology].filter(Boolean).join(" — ") ||
        raw.provenance || "AI Enterprise category share estimate.",
    });
    // `previousEstimate` and `changePct` exist upstream but carry no date for
    // the earlier reading. An observation without a time cannot be placed on a
    // timeline, and inventing one to make the movement look richer is the
    // exact failure this catalogue exists to avoid. Movement in this series
    // therefore starts accumulating from our own repeated observations.
  }
  return { rows, attempted: estimates.length, failures: [] };
}


// ── finance series (private-company reported figures) ──────────────────────

/**
 * One metric per kind of figure, so movement only ever compares like with
 * like. A run-rate annualises one month; GAAP annual revenue is a different
 * quantity; a projection is a hope with a date on it; an in-talks valuation
 * is a rumour. Each gets its own metric, and none is ever diffed against
 * another.
 */
function financeMetric(rec, kind) {
  if (kind === "valuation") {
    return rec.state === "in_talks"
      ? "valuation_in_talks_usd_m"
      : "valuation_post_money_usd_m";
  }
  return {
    run_rate: "revenue_run_rate_usd_m",
    arr: "revenue_arr_usd_m",
    annual: "revenue_annual_usd_m",
    projection: "revenue_projection_usd_m",
  }[rec.basis] ?? null;
}

function ingestFinance() {
  const file = path.join(process.cwd(), "lib", "finance", "data", "private-figures.json");
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { rows: [], attempted: 0, failures: [{ subject: "private-figures.json", reason: String(e.message ?? e) }] };
  }

  const rows = [];
  const failures = [];
  const push = (rec, kind, valueUsdM, label) => {
    const metric = financeMetric(rec, kind);
    if (!metric) {
      failures.push({ subject: `${rec.vendorId} ${kind}`, reason: `unmapped basis ${rec.basis ?? rec.state}` });
      return;
    }
    rows.push({
      series: "vendor",
      subject_kind: "vendor",
      subject_id: rec.vendorId,
      subject_label: label,
      metric,
      value_num: valueUsdM,
      unit: "USD millions",
      // The citation's date is when the figure was true — not today.
      observed_at: `${rec.citation.asOf}T00:00:00Z`,
      source_id: "press_reported_figures",
      vintage: `${kind === "valuation" ? rec.state : rec.basis}${rec.isFloor ? ", floor" : ""} — ${rec.citation.publisher}, ${rec.citation.asOf}`,
      provenance:
        `${rec.citation.quote} (${rec.citation.publisher}, ${rec.citation.asOf}.)` +
        (rec.caveats ? ` Caveats: ${rec.caveats}` : "") +
        (rec.isFloor ? " Reported as a floor: the true figure is at least this." : ""),
    });
  };

  const names = new Map((raw.valuations ?? []).map((v) => [v.vendorId, v.vendorName]));
  for (const v of raw.valuations ?? []) push(v, "valuation", v.valuationUsdM, v.vendorName);
  for (const r of raw.revenues ?? [])
    push(r, "revenue", r.revenueUsdM,
      names.get(r.vendorId) ?? r.vendorId.charAt(0).toUpperCase() + r.vendorId.slice(1));

  return { rows, attempted: (raw.valuations?.length ?? 0) + (raw.revenues?.length ?? 0), failures };
}

// ── main ───────────────────────────────────────────────────────────────────

const SERIES = {
  model: { label: "Model movement", run: async () => ingestModels() },
  vendor: { label: "Vendor movement", run: ingestVendors },
  market: { label: "Market movement", run: async () => ingestMarket() },
  finance: { label: "Private-company figures", run: async () => ingestFinance() },
};

/** Quote a value for the SQL-emitting mode. */
function lit(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function emitSql(rows, series, attempted, failures) {
  const cols = [
    "series", "subject_kind", "subject_id", "subject_label", "metric",
    "value_num", "value_text", "unit", "observed_at", "source_id",
    "provenance", "vintage",
  ];
  const out = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    out.push(
      `insert into aie.observation (${cols.join(", ")}) values\n` +
        chunk
          .map((r) => "  (" + cols.map((c) => lit(r[c] ?? null)).join(", ") + ")")
          .join(",\n") +
        "\non conflict (series, subject_id, metric, observed_at) do nothing;"
    );
  }
  out.push(
    `insert into aie.ingestion_run (series, finished_at, ok, attempted, rows_written, failures, note) values (` +
      [lit(series), "now()", failures.length === 0, attempted, rows.length,
       lit(JSON.stringify(failures)) + "::jsonb", lit(series + " ingestion")].join(", ") +
      ");"
  );
  return out.join("\n\n");
}

async function main() {
  const sqlMode = process.argv.includes("--sql");
  if (sqlMode) {
    const wanted = process.argv.filter((a) => SERIES[a]);
    const list = wanted.length ? wanted : Object.keys(SERIES);
    const chunks = [];
    for (const name of list) {
      const { rows, attempted, failures } = await SERIES[name].run();
      chunks.push(`-- ${SERIES[name].label}: ${rows.length} observations`);
      chunks.push(emitSql(rows, name, attempted, failures));
    }
    process.stdout.write(chunks.join("\n\n") + "\n");
    return;
  }

  if (!SERVICE_KEY) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
        "The catalogue is readable without it, but writing needs the service key —\n" +
        "anonymous callers deliberately cannot write. Set it in the environment and re-run."
    );
    process.exit(1);
  }

  const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(SERIES);
  let total = 0;
  for (const name of wanted) {
    const s = SERIES[name];
    if (!s) {
      console.error(`Unknown series: ${name}. Known: ${Object.keys(SERIES).join(", ")}`);
      process.exit(1);
    }
    console.log(`\n${s.label}`);
    const { rows, attempted, failures } = await s.run();
    const written = await writeObservations(rows);
    await writeRun(name, attempted, written, failures, s.label);
    total += written;
    console.log(
      `  → ${written} observations from ${attempted} subjects` +
        (failures.length ? `, ${failures.length} failed (recorded, not hidden)` : "")
    );
  }
  console.log(`\nWrote ${total} observations.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
