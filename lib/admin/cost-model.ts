// What an ingestion run costs.
//
// The honest headline first: at current scale, on the plans this product
// actually runs on (Vercel Hobby, Supabase Free), the marginal cost of every
// ingestion run is $0.00: both plans are hard-capped rather than metered,
// and every upstream API is free. The priced column on the admin page is
// therefore LIST-PRICE ARITHMETIC: measured quantities multiplied by the
// platforms' published paid-tier unit prices, showing what a run would cost
// if the caps were ever outgrown. It is an estimate of a hypothetical, and
// it is labelled as one.
//
// Everything here is measured or cited; nothing is a vibe. The unit prices
// carry their source and date; the run profiles carry how each number was
// measured. When a price or a profile drifts, this file is the one place to
// correct it, and the tests hold the arithmetic to the profiles.

/**
 * Published unit prices, as of 5 August 2026.
 *
 * Vercel (Pro list prices; Hobby is $0 within hard caps):
 *   invocations $0.60 per million, Active CPU $0.128/hour (base region),
 *   provisioned memory $0.0106/GB-hour. Fluid compute bills CPU only while
 *   code executes , not during I/O waits, but provisioned memory accrues on
 *   wall time. Source: vercel.com/docs/functions/usage-and-pricing.
 *
 * Supabase (Free tier: 500MB database, 5GB egress, unlimited API requests;
 *   Pro $25/month with 8GB database included). Source: supabase.com/pricing.
 *
 * Upstreams: SEC EDGAR and the Federal Register are US government works with
 * no fee; the ranking-engine feed is this product's own upstream, unmetered.
 */
export const UNIT_PRICES = {
  vercelInvocationUsd: 0.60 / 1_000_000,
  vercelActiveCpuUsdPerSecond: 0.128 / 3600,
  vercelMemoryUsdPerGbSecond: 0.0106 / 3600,
  /** The default fluid instance size the routes run on. */
  vercelMemoryGb: 1.7,
  /** Every upstream this product ingests from charges nothing. */
  upstreamUsd: 0,
  asOf: "2026-08-05",
} as const;

export interface RunProfile {
  series: string;
  label: string;
  /** Outbound HTTP requests one run makes. Counted from the ingestion code. */
  requests: number;
  /** Approximate bytes transferred in, measured from live responses. */
  bytesIn: number;
  /**
   * Seconds the CPU is actually executing. Estimated from measured wall time
   * minus network waits and deliberate throttle sleeps: fluid compute does
   * not bill the waits, but this is the least certain number here and is
   * labelled an estimate wherever it is shown.
   */
  activeCpuSeconds: number;
  /** Wall-clock seconds, which is what provisioned memory accrues on. */
  wallSeconds: number;
  /** Rows written to the catalogue by one run. */
  rowsWritten: number;
  /** How each figure was arrived at, shown in the drawer. */
  measured: string;
}

/**
 * One profile per ingestion, measured on 4-5 August 2026.
 *
 * The throttle sleeps dominate wall time on the SEC ingestions on purpose:
 * SEC fair access asks for under 10 requests a second, and the 250ms gaps are
 * the polite pace, not an inefficiency to optimise away.
 */
export const RUN_PROFILES: RunProfile[] = [
  {
    series: "adoption",
    label: "SEC disclosure snapshot (8 vendors, one window)",
    requests: 8,
    bytesIn: 270_000,
    activeCpuSeconds: 0.2,
    wallSeconds: 2.2,
    rowsWritten: 0,
    measured:
      "8 EDGAR full-text queries at ~34KB each, 250ms throttle between them; measured ~2s wall on the live route. Writes a JSON snapshot, not catalogue rows.",
  },
  {
    series: "vendor",
    label: "SEC disclosure, two 12-month windows (8 vendors)",
    requests: 16,
    bytesIn: 550_000,
    activeCpuSeconds: 0.3,
    wallSeconds: 8,
    rowsWritten: 16,
    measured:
      "16 EDGAR queries across two dated windows with 250ms throttles; ~8s wall measured at ingestion on 4 August. 16 observations written.",
  },
  {
    series: "model",
    label: "Model catalogue snapshot (330 models)",
    requests: 0,
    bytesIn: 0,
    activeCpuSeconds: 0.4,
    wallSeconds: 1.5,
    rowsWritten: 1252,
    measured:
      "Reads the 132KB bundled snapshot, no external requests; 1,252 observations written in three batched inserts (~500KB to Postgres).",
  },
  {
    series: "market",
    label: "AIE category share refresh (72 estimates)",
    requests: 0,
    bytesIn: 0,
    activeCpuSeconds: 0.1,
    wallSeconds: 0.5,
    rowsWritten: 72,
    measured: "Reads the bundled fixture, one batched insert of 72 observations.",
  },
  {
    series: "finance",
    label: "Private-company reported figures (evidence record)",
    requests: 0,
    bytesIn: 0,
    activeCpuSeconds: 0.1,
    wallSeconds: 0.4,
    rowsWritten: 21,
    measured:
      "Reads lib/finance/data/private-figures.json, one insert of 21 observations. The expensive part of this series is the human verification, which is not billable compute.",
  },
  {
    series: "news",
    label: "News feed cache refill (24h TTL)",
    requests: 1,
    bytesIn: 3_280_000,
    activeCpuSeconds: 0.5,
    wallSeconds: 1.5,
    rowsWritten: 0,
    measured:
      "One 3.28MB fetch from the ranking-engine feed (it ignores ?limit: measured, not assumed), trimmed in memory, held 24 hours per instance.",
  },
];

export interface RunCost {
  series: string;
  label: string;
  invocationUsd: number;
  cpuUsd: number;
  memoryUsd: number;
  upstreamUsd: number;
  totalUsd: number;
  profile: RunProfile;
}

/** List-price cost of one run. Fractions of a cent, and shown as such. */
export function costOfRun(profile: RunProfile): RunCost {
  const invocationUsd = UNIT_PRICES.vercelInvocationUsd;
  const cpuUsd =
    profile.activeCpuSeconds * UNIT_PRICES.vercelActiveCpuUsdPerSecond;
  const memoryUsd =
    profile.wallSeconds *
    UNIT_PRICES.vercelMemoryGb *
    UNIT_PRICES.vercelMemoryUsdPerGbSecond;
  const upstreamUsd = UNIT_PRICES.upstreamUsd;
  return {
    series: profile.series,
    label: profile.label,
    invocationUsd,
    cpuUsd,
    memoryUsd,
    upstreamUsd,
    totalUsd: invocationUsd + cpuUsd + memoryUsd + upstreamUsd,
    profile,
  };
}

export function allRunCosts(): RunCost[] {
  return RUN_PROFILES.map(costOfRun);
}

/**
 * What a refresh cadence would cost per month at list prices: every series,
 * every day, would still round to under a cent. Saying that with arithmetic
 * beats saying it with adjectives.
 */
export function monthlyUsd(runsPerDay: number): number {
  const perDay = allRunCosts().reduce((a, c) => a + c.totalUsd, 0) * runsPerDay;
  return perDay * 30;
}

/**
 * Formats a dollar amount honestly at sub-cent scale: enough decimals to see
 * the first significant figure, rather than rounding everything to "$0.00"
 * and losing the point of the column.
 */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(6).replace(/0+$/, "")}`;
}
