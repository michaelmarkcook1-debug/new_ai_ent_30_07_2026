import { aieServerFetch, type AieLane } from "@/lib/aie-server";
import { isInvestor } from "@/lib/vendor/is-investor";
import {
  categoryRankings,
  rankingsCapturedAt,
} from "@/lib/aie/category-rankings";

// Market metrics derived from the real AI Enterprise datasets.
//
// The rule this module exists to enforce: every figure it returns traces to a
// named field in a real payload, and anything the datasets do not cover comes
// back as null so the UI can render an empty cell. There is no default, no
// midpoint substitute and no filler. A null here means "not disclosed", and
// that is the honest answer.
//
// Source map, one metric to one field:
//   composite   -> vendors[].overallScore        (AG's own score, 0 to 100)
//   confidence  -> vendors[].confidenceScore     (the dataset's own confidence)
//   momentum    -> market-dashboard.agenticMomentum[].momentum.momentumScore
//   maturity    -> mean of capabilities.vendorCapabilities[].maturityScore
//   reputation  -> mean of reputation.rows[].{customer,developer,employee}.overall
//   share       -> market-share.estimates[].estimatedShare, per category
//
// Nothing is blended across sources into a single headline number: the spec
// forbids compositing a third-party signal into an AG score, and mixing these
// would also hide which input moved.

export interface PillarScores {
  customer: number | null;
  developer: number | null;
  employee: number | null;
}

export interface VendorMetrics {
  id: string;
  name: string;
  category: string;
  marketPosition: string | null;
  lastUpdated: string | null;

  composite: number | null;
  compositeConfidence: number | null;

  momentum: number | null;
  momentumConfidence: number | null;

  maturity: number | null;
  /** How many capability rows the maturity mean was taken over. */
  maturityRows: number;
  /** Weakest evidence grade among those rows: the honest ceiling on the mean. */
  maturityEvidence: string | null;

  reputation: number | null;
  reputationPillars: PillarScores | null;
}

export interface CategoryShare {
  vendorId: string;
  categoryId: string;
  estimatedShare: number;
  confidence: number;
  source: string;
  sourceDate: string;
  methodology: string;
  changePct: number | null;
}

export interface MarketSignal {
  vendorId: string;
  vendorName: string;
  headline: string;
  severity: string | null;
  confidence: number | null;
}

export interface MarketKpi {
  label: string;
  tooltip: string;
  score: number | null;
  delta: number | null;
  definition: string;
  invert?: boolean;
  /** Exact field this aggregates, shown in the derivation drawer. */
  sourceField: string;
  sampleSize: number;
}

export interface MarketMetrics {
  vendors: VendorMetrics[];
  shares: CategoryShare[];
  kpis: MarketKpi[];
  risks: MarketSignal[];
  gaining: MarketSignal[];
  slipping: MarketSignal[];
  /** Worst lane across the pulls, so a badge cannot overclaim. */
  lane: AieLane;
  generatedAt: string | null;
  reputationAsOf: string | null;
  shareAsOf: string | null;
  /**
   * False when the share dataset carries prior estimates that are identical to
   * the current ones. Surfaces should then say movement is not yet published
   * rather than render a flat zero as though the market were static.
   */
  shareMovementPublished: boolean;
  /**
   * v1's category composite, keyed categoryId then vendorId.
   *
   * This is the number v1's own front page ranks on, and it is not
   * `overallScore`. The two disagree: in frontier models overallScore puts
   * OpenAI first and this puts Anthropic first, by 0.29 rather than by a
   * rounding error. Both are v1's; the difference is that this one weights
   * each category's domains separately, caps a domain by its evidence grade,
   * and holds a vendor under 60% coverage instead of ranking it on defaults.
   *
   * Keyed by category because a vendor scores differently in each one it
   * competes in. Anthropic is 3.65 in frontier models and 3.69 as a coding
   * agent, so there is no single composite for a vendor to carry on its row.
   */
  categoryComposites: Record<
    string,
    Record<string, { composite: number; rank: number; position: string | null }>
  >;
  /** Withheld for thin evidence, per category. Not absent, not zero. */
  categoryHeld: Record<string, number>;
  /** When v1's rankings were last read. */
  compositesCapturedAt: string;
}

// ---------- upstream payload shapes (only the fields used) ----------

interface RawVendor {
  id: string;
  name: string;
  category: string;
  overallScore: number | null;
  confidenceScore: number | null;
  marketPosition: string | null;
  lastUpdated: string | null;
}
interface RawCapabilityRow {
  vendorId: string;
  maturityScore: number | null;
  evidenceGrade: string | null;
  status: string | null;
}
interface RawPillar {
  overall: number | null;
}
interface RawReputationRow {
  vendorId: string;
  customer: RawPillar | null;
  developer: RawPillar | null;
  employee: RawPillar | null;
}
interface RawDashboardEntry {
  vendor: { id: string; name: string };
  reason?: string;
  alert?: string;
  severity?: string;
  confidence?: number;
  momentum?: { momentumScore?: number | null; confidence?: number | null };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

// Evidence grades run E1 (strongest) to E5. A mean over mixed grades is only
// as good as its weakest input, so that is what gets reported.
function weakestGrade(grades: string[]): string | null {
  const present = grades.filter(Boolean).sort();
  return present.length ? present[present.length - 1] : null;
}

export async function loadMarketMetrics(): Promise<MarketMetrics> {
  const [vendorsRes, capsRes, repRes, shareRes, dashRes] = await Promise.all([
    aieServerFetch<{ vendors: RawVendor[] }>("vendors"),
    aieServerFetch<{ vendorCapabilities: RawCapabilityRow[] }>("capabilities"),
    aieServerFetch<{ rows: RawReputationRow[]; asOf?: string }>("reputation"),
    aieServerFetch<{ estimates: CategoryShare[]; asOf?: string }>("market-share"),
    aieServerFetch<{
      generatedAt?: string;
      agenticMomentum?: RawDashboardEntry[];
      riskAlerts?: RawDashboardEntry[];
      winningVendors?: RawDashboardEntry[];
      losingVendors?: RawDashboardEntry[];
    }>("market-dashboard"),
  ]);

  // A single fixture read downgrades the whole badge: the page cannot claim
  // live when any part of it came from a recording.
  const lane: AieLane = [vendorsRes, capsRes, repRes, shareRes, dashRes].some(
    (r) => r.lane === "aie"
  )
    ? "aie"
    : "aie-live";

  // Suppliers only. The feed carries four investment firms beside the vendors,
  // and this roster drives the Pulse momentum panel, which was telling a reader
  // it was "worth a dated check before renewing or widening SoftBank". There is
  // no contract with SoftBank to renew. Same rule as the composite, one
  // definition, in lib/vendor/is-investor.ts.
  const rawVendors = (vendorsRes.data?.vendors ?? []).filter(
    (v) => !isInvestor(v.id)
  );

  // Capability maturity, grouped per vendor.
  const capsByVendor = new Map<string, RawCapabilityRow[]>();
  for (const row of capsRes.data?.vendorCapabilities ?? []) {
    const list = capsByVendor.get(row.vendorId) ?? [];
    list.push(row);
    capsByVendor.set(row.vendorId, list);
  }

  const repByVendor = new Map<string, RawReputationRow>();
  for (const row of repRes.data?.rows ?? []) repByVendor.set(row.vendorId, row);

  const momentumByVendor = new Map<string, RawDashboardEntry>();
  for (const row of dashRes.data?.agenticMomentum ?? []) {
    momentumByVendor.set(row.vendor.id, row);
  }

  const vendors: VendorMetrics[] = rawVendors.map((v) => {
    const capRows = capsByVendor.get(v.id) ?? [];
    const scored = capRows
      .map((r) => r.maturityScore)
      .filter((n): n is number => typeof n === "number");

    const rep = repByVendor.get(v.id);
    const pillars: PillarScores | null = rep
      ? {
          customer: rep.customer?.overall ?? null,
          developer: rep.developer?.overall ?? null,
          employee: rep.employee?.overall ?? null,
        }
      : null;
    const pillarValues = pillars
      ? [pillars.customer, pillars.developer, pillars.employee].filter(
          (n): n is number => typeof n === "number"
        )
      : [];

    const mom = momentumByVendor.get(v.id);

    return {
      id: v.id,
      name: v.name,
      category: v.category,
      marketPosition: v.marketPosition ?? null,
      lastUpdated: v.lastUpdated ?? null,
      composite: v.overallScore ?? null,
      compositeConfidence: v.confidenceScore ?? null,
      momentum: mom?.momentum?.momentumScore ?? null,
      momentumConfidence: mom?.momentum?.confidence ?? null,
      maturity: round1(mean(scored)),
      maturityRows: scored.length,
      maturityEvidence: weakestGrade(
        capRows.map((r) => r.evidenceGrade ?? "").filter(Boolean)
      ),
      reputation: round1(mean(pillarValues)),
      reputationPillars: pillars,
    };
  });

  const shares = shareRes.data?.estimates ?? [];

  const signal = (
    rows: RawDashboardEntry[] | undefined,
    field: "alert" | "reason"
  ): MarketSignal[] =>
    (rows ?? [])
      // The gaining, slipping and risk lists come from the dashboard payload
      // rather than from the vendor roster, so filtering that roster above did
      // not reach them. This is where "SoftBank slipping" got into the Pulse
      // headline and into the reading written over it.
      .filter((r) => !isInvestor(r.vendor.id))
      .map((r) => ({
        vendorId: r.vendor.id,
        vendorName: r.vendor.name,
        headline: (field === "alert" ? r.alert : r.reason) ?? "",
        severity: r.severity ?? null,
        confidence: typeof r.confidence === "number" ? r.confidence : null,
      }));

  // ---------- market-level aggregates ----------
  const composites = vendors
    .map((v) => v.composite)
    .filter((n): n is number => n !== null);
  const maturities = vendors
    .map((v) => v.maturity)
    .filter((n): n is number => n !== null);
  const reputations = vendors
    .map((v) => v.reputation)
    .filter((n): n is number => n !== null);

  // Share movement looks available (every estimate carries previousEstimate
  // and changePct) but no estimate has actually moved: previousEstimate is a
  // copy of the current value and every changePct is 0. Reporting "0% gaining"
  // off that would read as "nothing is growing" when the truth is "no movement
  // is published yet". So movement is reported only if some estimate really
  // moved, and otherwise suppressed.
  const movedShares = shares.filter(
    (s) => typeof s.changePct === "number" && s.changePct !== 0
  );
  const shareMovementPublished = movedShares.length > 0;

  const risks = signal(dashRes.data?.riskAlerts, "alert");
  const highRisks = risks.filter((r) => r.severity === "high").length;

  // Labels are written for someone reading the page for the first time.
  //
  // "Analyst composite" was the first label on the first gauge, which invited
  // exactly the wrong reading: that an industry analyst firm scored these
  // vendors. It is AI Enterprise's own assessment (the dataset calls the field
  // an analyst_estimate, meaning its in-house analyst). Spec rule 4 forbids
  // blending third-party recognition into an AG score, so a label that merely
  // implies it is a defect even when the underlying data is clean. Every gauge
  // now says what it measures in plain words; the field names live in the
  // derivation drawer, which is where a reader goes for them.
  const kpis: MarketKpi[] = [
    {
      label: "AVERAGE AG VENDOR SCORE",
      tooltip:
        "How the typical tracked AI vendor scores overall on AG's own assessment, out of 100. AG's score, not a rating from any industry analyst firm.",
      score: round1(mean(composites)),
      delta: null,
      definition:
        "AG's own overall score for each tracked AI vendor, averaged across the set, out of 100. Produced by AG, not by any industry analyst firm. No earlier period is published, so no change is shown.",
      sourceField: "vendors[].overallScore",
      sampleSize: composites.length,
    },
    {
      label: "AVERAGE AG CAPABILITY SCORE",
      tooltip:
        "How mature the typical vendor's product is across ten areas AG assesses: agents, security, governance, integrations and six more. AG's assessment, 0 to 100.",
      score: round1(mean(maturities)),
      delta: null,
      definition:
        "How mature the typical vendor's product is, out of 100, averaged across the ten capability areas AG assesses. AG's assessment, with every underlying row carrying an evidence grade.",
      sourceField: "capabilities.vendorCapabilities[].maturityScore",
      sampleSize: maturities.length,
    },
    {
      label: "AVERAGE REPUTATION",
      tooltip:
        "How the typical vendor is rated by the people who buy it, build on it and work in it. Aggregated by AG from external sources such as G2, GitHub and Glassdoor; the ratings are theirs, not AG's.",
      score: round1(mean(reputations)),
      delta: null,
      definition:
        "How the typical vendor is rated by its customers, its developers and its own employees, out of 100. AG aggregates these from external review, developer and workplace sources; the underlying ratings are theirs, not AG's. Covers fewer vendors than the full tracked set.",
      sourceField: "reputation.rows[].{customer,developer,employee}.overall",
      sampleSize: reputations.length,
    },
    {
      label: "HIGH-SEVERITY RISK ALERTS",
      tooltip:
        "How many serious risks are currently flagged across all tracked vendors. A count, not a score out of 100, and fewer is better.",
      score: highRisks === 0 ? 0 : highRisks,
      delta: null,
      definition:
        "How many serious risks are currently flagged across all tracked vendors. This is a count, not a score out of 100, and fewer is better.",
      invert: true,
      sourceField: "market-dashboard.riskAlerts[] where severity = high",
      sampleSize: risks.length,
    },
  ];

  return {
    vendors,
    shares,
    kpis,
    risks,
    gaining: signal(dashRes.data?.winningVendors, "reason"),
    slipping: signal(dashRes.data?.losingVendors, "reason"),
    lane,
    generatedAt: dashRes.data?.generatedAt ?? null,
    reputationAsOf: repRes.data?.asOf ?? null,
    shareAsOf: shareRes.data?.asOf ?? null,
    shareMovementPublished,
    ...categoryCompositePayload(),
  };
}

/**
 * v1's category rankings, flattened for the browser.
 *
 * Read from the recorded fixture rather than fetched, because v1 does not
 * publish this on its API: it is computed into the /category/<id> pages and
 * scripts/sync-category-rankings.mjs parses them. That script fails loudly and
 * reconciles per category against market-share, so a thin payload here means
 * nobody ran it, never that it ran and found nothing.
 */
function categoryCompositePayload(): {
  categoryComposites: MarketMetrics["categoryComposites"];
  categoryHeld: Record<string, number>;
  compositesCapturedAt: string;
} {
  const byCategory: MarketMetrics["categoryComposites"] = {};
  const held: Record<string, number> = {};
  for (const c of categoryRankings()) {
    const row: Record<
      string,
      { composite: number; rank: number; position: string | null }
    > = {};
    for (const r of c.ranked) {
      row[r.vendorId] = {
        composite: r.composite,
        rank: r.rank,
        position: r.position,
      };
    }
    byCategory[c.categoryId] = row;
    held[c.categoryId] = c.held;
  }
  return {
    categoryComposites: byCategory,
    categoryHeld: held,
    compositesCapturedAt: rankingsCapturedAt(),
  };
}
