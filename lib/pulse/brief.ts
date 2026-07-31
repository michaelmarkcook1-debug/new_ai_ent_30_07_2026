import type { DataLane } from "@/lib/provenance";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { CostCapabilityModel } from "@/app/(ai-ent)/price-performance/data";

// Derivations behind the executive brief.
//
// Everything here reads figures the app already computes and turns them into a
// decision. It calculates no new vendor score: lib/market-metrics.ts remains
// the only place a composite is produced, and this module consumes it.
//
// The honest constraint that shapes most of this file: the AIE datasets publish
// current values with no prior period. The KPI derivation drawer already says
// so, and the share dataset's changePct is zero on every row because each prior
// estimate is a copy of the current one. So a scorecard cannot show a direction
// of travel for most dimensions without inventing one. Where a real prior
// reading exists the direction is given; where it does not, the dimension says
// the direction is not published rather than drawing an arrow that means
// nothing.

export type Confidence = "High" | "Medium" | "Low";
export type Horizon = "Immediate" | "30 days" | "90 days" | "12 months";
export type Direction = "up" | "down" | "flat" | "unpublished";

/**
 * Metadata every visible recommendation carries. Evidence state reuses the
 * existing DataLane taxonomy rather than introducing a parallel one, and
 * confidence is separate from it: a live figure can still support only a
 * low-confidence call, and a derived one can support a high-confidence call.
 */
export interface RecommendationMeta {
  confidence: Confidence;
  horizon: Horizon;
  lane: DataLane;
  lastUpdated: string | null;
}

export interface ScorecardDimension {
  key: string;
  name: string;
  status: string;
  direction: Direction;
  /** One sentence on what the reading means for a buyer. */
  meaning: string;
  confidence: Confidence;
  lane: DataLane;
  /** The figures this was computed from, shown in the evidence drawer. */
  basis: string;
}

export interface PricePick {
  slot: string;
  model: string | null;
  reason: string;
  fit: string;
  meta: RecommendationMeta;
  /** Set when the data cannot support a pick, in the product's own language. */
  unavailable: string | null;
}

export interface ExecutiveBrief {
  scorecard: ScorecardDimension[];
  overall: { recommendation: string; meta: RecommendationMeta };
  /**
   * The computed values behind the dimensions, returned rather than re-derived
   * by callers. The actions and signals cite the same numbers the scorecard
   * shows, and cannot drift from them.
   */
  facts: {
    priceRatio: number | null;
    highRisks: number | null;
    readiness: number | null;
    gaining: number;
    slipping: number;
    pricedModels: number;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- scorecard

/**
 * Five enterprise dimensions, each computed from figures already on the page.
 *
 * Deliberately not five vendor scores averaged into a shape. Each answers a
 * different buying question, and each carries the numbers it came from.
 */
export function buildScorecard(
  metrics: MarketMetrics,
  models: CostCapabilityModel[]
): ExecutiveBrief {
  const lane = metrics.lane;
  const updated = metrics.generatedAt ?? null;

  const dims: ScorecardDimension[] = [];

  // 1. Market momentum. Real directional signal: the dataset publishes a
  // rolling 30 day momentum read and classifies vendors as gaining or
  // slipping, so this is the one dimension with a genuine direction.
  const gaining = metrics.gaining.length;
  const slipping = metrics.slipping.length;
  const netMovers = gaining - slipping;
  dims.push({
    key: "momentum",
    name: "Market momentum",
    status:
      gaining + slipping === 0
        ? "Not published"
        : netMovers > 0
          ? "Expanding"
          : netMovers < 0
            ? "Contracting"
            : "Balanced",
    direction:
      gaining + slipping === 0 ? "unpublished" : netMovers > 0 ? "up" : netMovers < 0 ? "down" : "flat",
    meaning:
      gaining + slipping === 0
        ? "No vendor is currently classified as gaining or slipping."
        : netMovers > 0
          ? `More vendors are gaining than slipping (${gaining} against ${slipping}), so the field is still opening rather than consolidating.`
          : netMovers < 0
            ? `More vendors are slipping than gaining (${slipping} against ${gaining}), which points to consolidation around fewer credible options.`
            : `Gainers and decliners are evenly matched (${gaining} each), so no clear direction in the field.`,
    confidence: gaining + slipping >= 6 ? "High" : gaining + slipping >= 3 ? "Medium" : "Low",
    lane,
    basis: `${gaining} vendors reading as gaining, ${slipping} as slipping, from the AIE market dashboard's own classification.`,
  });

  // 2. Enterprise readiness. Mean assessed capability maturity across the
  // tracked set, which is what "is this market ready to buy from" reduces to.
  const maturity = metrics.kpis.find((k) =>
    k.label.toUpperCase().includes("CAPABILITY")
  );
  const mScore = maturity?.score ?? null;
  dims.push({
    key: "readiness",
    name: "Enterprise readiness",
    status:
      mScore === null
        ? "Not published"
        : mScore >= 70
          ? "Strong"
          : mScore >= 55
            ? "Workable"
            : "Early",
    direction: "unpublished",
    meaning:
      mScore === null
        ? "Capability maturity is not published for the tracked set."
        : mScore >= 70
          ? `The typical tracked vendor scores ${mScore} for assessed capability maturity, so most shortlists will contain production-ready options.`
          : mScore >= 55
            ? `The typical tracked vendor scores ${mScore} for assessed capability maturity: workable, but capability varies enough that the shortlist matters more than the market.`
            : `The typical tracked vendor scores ${mScore} for assessed capability maturity, so expect to carry more integration and assurance work in-house.`,
    confidence: maturity && maturity.sampleSize >= 30 ? "High" : "Medium",
    lane,
    basis: maturity
      ? `Mean of ${maturity.sourceField} over ${maturity.sampleSize} vendors. No prior period is published, so no direction of travel is shown.`
      : "Not available in the current payload.",
  });

  // 3. Price efficiency. Cross-sectional, not a trend: what a point of
  // benchmarked intelligence costs at the frontier against the rest of the
  // field. A wide gap means the expensive tier is optional for most work,
  // which is the actual buying conclusion.
  const priced = models.filter(
    (m) => m.inputPerM > 0 && typeof m.intelligence === "number"
  );
  const frontier = priced.filter((m) => m.frontier);
  const rest = priced.filter((m) => !m.frontier);
  const costPerPoint = (list: CostCapabilityModel[]) =>
    list.length
      ? round1(
          list.reduce((a, m) => a + m.inputPerM / m.intelligence, 0) / list.length
        )
      : null;
  const fCost = costPerPoint(frontier);
  const rCost = costPerPoint(rest);
  const ratio = fCost !== null && rCost !== null && rCost > 0 ? round1(fCost / rCost) : null;
  dims.push({
    key: "price",
    name: "Price efficiency",
    status:
      ratio === null ? "Not published" : ratio >= 2 ? "Favourable" : ratio >= 1.2 ? "Mixed" : "Tight",
    direction: "unpublished",
    meaning:
      ratio === null
        ? "Not enough priced models with benchmark scores to compare tiers."
        : ratio >= 2
          ? `Frontier models cost about ${ratio} times as much per point of benchmarked intelligence as the rest of the field, so paying frontier rates for routine work is expensive by a wide margin.`
          : ratio >= 1.2
            ? `Frontier models cost about ${ratio} times as much per point of benchmarked intelligence as the rest of the field, so the premium is real but not decisive.`
            : "Frontier and mainstream models cost about the same per point of benchmarked intelligence, so tiering by cost alone saves little.",
    confidence: priced.length >= 100 ? "High" : priced.length >= 30 ? "Medium" : "Low",
    lane: "derived",
    basis: `${frontier.length} frontier and ${rest.length} non-frontier models with both a price and a benchmark score. Cross-sectional comparison of the current capture: only one capture exists, so this is not a trend.`,
  });

  // 4. Governance and operational risk. A count of open high-severity risks,
  // which is the figure the dataset actually publishes.
  const riskKpi = metrics.kpis.find((k) => k.label.toUpperCase().includes("RISK"));
  const highRisks = riskKpi?.score ?? null;
  dims.push({
    key: "risk",
    name: "Governance and operational risk",
    status:
      highRisks === null
        ? "Not published"
        : highRisks === 0
          ? "Clear"
          : highRisks <= 3
            ? "Contained"
            : "Elevated",
    direction: "unpublished",
    meaning:
      highRisks === null
        ? "Open risk counts are not published for the tracked set."
        : highRisks === 0
          ? "No high-severity risk is open against a tracked vendor."
          : `${highRisks} high-severity ${highRisks === 1 ? "risk is" : "risks are"} open against tracked vendors, so governance review belongs in the shortlist stage rather than after it.`,
    confidence: "High",
    lane,
    basis: riskKpi
      ? `Count of ${riskKpi.sourceField} over ${riskKpi.sampleSize} records.`
      : "Not available in the current payload.",
  });

  // 5. Competitive intensity. How concentrated the estimated share is: a
  // market where the top few hold most of it gives a buyer less leverage.
  const shares = [...metrics.shares]
    .map((s) => s.estimatedShare)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => b - a);
  const top3 = shares.slice(0, 3).reduce((a, b) => a + b, 0);
  const hasShare = shares.length >= 4;
  dims.push({
    key: "intensity",
    name: "Competitive intensity",
    status: !hasShare ? "Not published" : top3 >= 60 ? "Concentrated" : top3 >= 40 ? "Moderate" : "Fragmented",
    direction: metrics.shareMovementPublished ? "flat" : "unpublished",
    meaning: !hasShare
      ? "Not enough share estimates to judge concentration."
      : top3 >= 60
        ? `The top three positions hold about ${round1(top3)} per cent of estimated share, so buyers face few real alternatives and less pricing leverage.`
        : top3 >= 40
          ? `The top three positions hold about ${round1(top3)} per cent of estimated share, leaving credible alternatives in most categories.`
          : `Estimated share is spread widely, with the top three holding about ${round1(top3)} per cent, so there is room to negotiate against genuine alternatives.`,
    confidence: hasShare ? "Medium" : "Low",
    lane,
    basis: metrics.shareMovementPublished
      ? `Sum of the three largest estimated category shares, across ${shares.length} estimates.`
      : `Sum of the three largest estimated category shares, across ${shares.length} estimates. The source publishes no movement for these, so no direction is shown.`,
  });

  // Overall recommendation, assembled from the dimensions rather than asserted
  // over the top of them. It only claims what the readings support.
  const priceFavourable = ratio !== null && ratio >= 2;
  const readinessOk = mScore !== null && mScore >= 55;
  const riskElevated = highRisks !== null && highRisks > 3;

  let overall: string;
  if (!readinessOk && riskElevated) {
    overall =
      "Hold scope tight. Capability across the tracked set is early and high-severity risks are open, so run contained pilots with named owners rather than committing to a platform.";
  } else if (readinessOk && priceFavourable) {
    overall =
      "Accelerate controlled adoption while applying commercial pressure. Capability is sufficient to deploy against real work, and the price spread between tiers is wide enough that matching model tier to task is the largest available saving.";
  } else if (readinessOk) {
    overall =
      "Proceed selectively. Capability supports production use, but the price gap between tiers is not wide enough to fund tiering on cost alone, so choose on fit and governance.";
  } else {
    overall =
      "Test before committing. The tracked set is not yet uniformly production-ready, so favour short commitments and re-evaluate as evidence accumulates.";
  }

  return {
    scorecard: dims,
    overall: {
      recommendation: overall,
      meta: {
        confidence: readinessOk && priced.length >= 100 ? "Medium" : "Low",
        horizon: "90 days",
        lane: "derived",
        lastUpdated: updated,
      },
    },
    facts: {
      priceRatio: ratio,
      highRisks,
      readiness: mScore,
      gaining,
      slipping,
      pricedModels: priced.length,
    },
  };
}

// ------------------------------------------------------- price / performance

/**
 * The five price-performance calls a buyer actually makes, from the benchmark
 * capture. Each names the model and why, or says plainly that the data cannot
 * support the call.
 */
export function buildPricePicks(
  models: CostCapabilityModel[],
  capturedAt: string | null,
  benchmarkSource: string
): PricePick[] {
  const priced = models.filter(
    (m) => m.inputPerM > 0 && typeof m.intelligence === "number"
  );
  const meta = (confidence: Confidence, horizon: Horizon): RecommendationMeta => ({
    confidence,
    horizon,
    lane: "derived",
    lastUpdated: capturedAt,
  });

  if (priced.length === 0) {
    return [
      {
        slot: "Price-performance",
        model: null,
        reason: "",
        fit: "",
        meta: meta("Low", "30 days"),
        unavailable: "Data unavailable: no model in the capture carries both a price and a benchmark score.",
      },
    ];
  }

  // Value = benchmarked intelligence per dollar of input cost. The metric is
  // crude on purpose: it is the one both halves of the capture support.
  const byValue = [...priced].sort(
    (a, b) => b.intelligence / b.inputPerM - a.intelligence / a.inputPerM
  );
  const byIntelligence = [...priced].sort((a, b) => b.intelligence - a.intelligence);
  const median = (list: number[]) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const medIntel = median(priced.map((m) => m.intelligence));

  // Credible for enterprise work: at or above the median benchmark score, so
  // "best value" cannot be won by something too weak to use.
  const credible = byValue.filter((m) => m.intelligence >= medIntel);
  const bestValue = credible[0] ?? byValue[0] ?? null;
  const cheapest = [...priced].sort((a, b) => a.inputPerM - b.inputPerM)[0] ?? null;
  const bestReasoning = byIntelligence[0] ?? null;

  // Priced above evidenced value: expensive relative to what it scores, judged
  // against the field rather than an absolute threshold.
  const worstValue = [...priced]
    .filter((m) => m.inputPerM >= median(priced.map((x) => x.inputPerM)))
    .sort((a, b) => a.intelligence / a.inputPerM - b.intelligence / b.inputPerM)[0] ?? null;

  const vpd = (m: CostCapabilityModel) =>
    round1(m.intelligence / m.inputPerM);

  return [
    {
      slot: "Best value for enterprise work",
      model: bestValue?.model ?? null,
      reason: bestValue
        ? `Scores ${bestValue.intelligence} on the ${benchmarkSource} benchmark at $${bestValue.inputPerM} per million input tokens, giving ${vpd(bestValue)} points per dollar while staying at or above the median benchmark score.`
        : "",
      fit: "Mainstream knowledge work where quality matters but frontier reasoning is not required.",
      meta: meta("Medium", "90 days"),
      unavailable: bestValue ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    {
      slot: "Lowest cost",
      model: cheapest?.model ?? null,
      reason: cheapest
        ? `Cheapest priced model in the capture at $${cheapest.inputPerM} per million input tokens, scoring ${cheapest.intelligence} on the ${benchmarkSource} benchmark.`
        : "",
      fit: "High-volume, low-risk workflows where throughput and unit cost dominate.",
      meta: meta("Medium", "90 days"),
      unavailable: cheapest ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    {
      slot: "Complex reasoning",
      model: bestReasoning?.model ?? null,
      reason: bestReasoning
        ? `Highest benchmark score in the capture at ${bestReasoning.intelligence}, priced at $${bestReasoning.inputPerM} per million input tokens.`
        : "",
      fit: "Work where a wrong answer is expensive: strategy, complex analysis, regulated decisions.",
      meta: meta("Medium", "90 days"),
      unavailable: bestReasoning ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    {
      slot: "Largest price-performance improvement",
      model: null,
      reason: "",
      fit: "",
      meta: meta("Low", "90 days"),
      // Stated rather than estimated. One capture cannot show movement, and
      // guessing at an improvement would be the exact failure this app avoids.
      unavailable:
        "Insufficient evidence: only one benchmark capture is held, so no change over time can be shown. This becomes available once a second capture accumulates.",
    },
    {
      slot: "Priced above evidenced value",
      model: worstValue?.model ?? null,
      reason: worstValue
        ? `At $${worstValue.inputPerM} per million input tokens it returns ${vpd(worstValue)} benchmark points per dollar, the weakest return among models priced at or above the field median.`
        : "",
      fit: "Worth challenging at renewal, or reserving for the narrow cases that justify it.",
      meta: meta("Low", "90 days"),
      unavailable: worstValue ? null : "Insufficient evidence to make a reliable recommendation.",
    },
  ];
}

// ------------------------------------------------------------ decision status

export type DecisionStatus =
  | "Shortlist"
  | "Test"
  | "Expand"
  | "Renegotiate"
  | "Monitor"
  | "Pause"
  | "Avoid";

export interface VendorDecision {
  status: DecisionStatus;
  reason: string;
  meta: RecommendationMeta;
  keyDimensions: string[];
}

/**
 * Turns a composite into a decision without touching how the composite is
 * calculated. This is interpretation only: same number, stated as an action.
 */
export function decisionFor(
  composite: number | null,
  reputation: number | null,
  momentum: number | null,
  openRisk: boolean,
  lane: DataLane,
  lastUpdated: string | null
): VendorDecision {
  const dims: string[] = [];
  if (composite !== null) dims.push(`AG score ${composite}`);
  if (reputation !== null) dims.push(`reputation ${reputation}`);
  if (momentum !== null) dims.push(`momentum ${momentum}`);
  if (openRisk) dims.push("open high-severity risk");

  if (composite === null) {
    return {
      status: "Monitor",
      reason:
        "No composite is published for this vendor, so there is not enough to act on either way.",
      meta: { confidence: "Low", horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (openRisk) {
    return {
      status: "Pause",
      reason:
        "A high-severity risk is open against this vendor. Resolve it before expanding commitment, whatever the score says.",
      meta: { confidence: "Medium", horizon: "Immediate", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (composite >= 70) {
    return {
      status: "Shortlist",
      reason: `Scores ${composite} against its own market category, near the top of the tracked set.`,
      meta: { confidence: "Medium", horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (composite >= 55) {
    return {
      status: "Test",
      reason: `Scores ${composite}: credible enough for a contained pilot, not yet for a platform commitment.`,
      meta: { confidence: "Medium", horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  return {
    status: "Monitor",
    reason: `Scores ${composite} against its category, below the level that would justify a pilot on the published evidence.`,
    meta: { confidence: "Low", horizon: "12 months", lane, lastUpdated },
    keyDimensions: dims,
  };
}
