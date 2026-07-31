import { aieServerFetch, type AieLane } from "@/lib/aie-server";

// Market metrics derived from the real AI Enterprise datasets.
//
// The rule this module exists to enforce: every figure it returns traces to a
// named field in a real payload, and anything the datasets do not cover comes
// back as null so the UI can render an empty cell. There is no default, no
// midpoint substitute and no filler. A null here means "not disclosed", and
// that is the honest answer.
//
// Source map, one metric to one field:
//   composite   -> vendors[].overallScore        (analyst composite, 0 to 100)
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

  const rawVendors = vendorsRes.data?.vendors ?? [];

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
    (rows ?? []).map((r) => ({
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

  // Evidence coverage: how much of the capability set is verified rather than
  // inferred. This is a data-integrity readout, and it is real.
  const allCapRows = capsRes.data?.vendorCapabilities ?? [];
  const verifiedRows = allCapRows.filter((r) => r.status === "verified").length;
  const evidenceCoverage = allCapRows.length
    ? (verifiedRows / allCapRows.length) * 100
    : null;

  const risks = signal(dashRes.data?.riskAlerts, "alert");
  const highRisks = risks.filter((r) => r.severity === "high").length;

  const kpis: MarketKpi[] = [
    {
      label: "ANALYST COMPOSITE, MEAN",
      tooltip:
        "Mean of the AI Enterprise analyst composite across every tracked vendor that carries one. 0 to 100, higher is stronger.",
      score: round1(mean(composites)),
      delta: null,
      definition:
        "Mean overallScore across tracked vendors. No prior period is published, so no change is shown.",
      sourceField: "vendors[].overallScore",
      sampleSize: composites.length,
    },
    {
      label: "CAPABILITY MATURITY, MEAN",
      tooltip:
        "Mean evidence-graded capability maturity across the tracked vendor set, over ten assessed capabilities. 0 to 100.",
      score: round1(mean(maturities)),
      delta: null,
      definition:
        "Mean of each vendor's own mean maturityScore across its assessed capabilities. Every row carries an evidence grade.",
      sourceField: "capabilities.vendorCapabilities[].maturityScore",
      sampleSize: maturities.length,
    },
    {
      label: "REPUTATION, MEAN",
      tooltip:
        "Mean of the customer, developer and employee pillar scores across vendors the reputation dataset covers. 0 to 100.",
      score: round1(mean(reputations)),
      delta: null,
      definition:
        "Mean of the three pillar overall scores per vendor, then across vendors. Covers only vendors the dataset reaches.",
      sourceField: "reputation.rows[].{customer,developer,employee}.overall",
      sampleSize: reputations.length,
    },
    {
      label: "VERIFIED EVIDENCE COVERAGE",
      tooltip:
        "Share of assessed capability rows the dataset marks verified, rather than inferred, documented or tested. 0 to 100, higher means more of the picture is directly evidenced.",
      score: round1(evidenceCoverage),
      delta: null,
      definition:
        "Capability rows with status verified, as a percentage of all assessed rows. A readout on the evidence base itself, not on any vendor.",
      sourceField: "capabilities.vendorCapabilities[].status = verified",
      sampleSize: allCapRows.length,
    },
    {
      label: "OPEN HIGH-SEVERITY RISKS",
      tooltip:
        "Count of open risk alerts the dataset grades high severity. Lower is better, so the band colouring is inverted.",
      score: highRisks === 0 ? 0 : highRisks,
      delta: null,
      definition:
        "Count, not a 0 to 100 score: the gauge shows the raw number of high-severity alerts on the tracked set.",
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
  };
}
