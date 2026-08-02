import type { DataLane } from "@/lib/provenance";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { CostCapabilityModel } from "@/app/(ai-ent)/price-performance/data";
import { largestPriceImprovement } from "./price-improvement";

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

export type Horizon = "Immediate" | "30 days" | "90 days" | "12 months";
export type Direction = "up" | "down" | "flat" | "unpublished";

/**
 * How a reading should be coloured. This is the only thing on the page that
 * carries green, amber or red: a reader should be able to tell good from bad
 * without reading a word.
 *
 * Provenance badges stay neutral. The old arrangement spent all the colour on
 * lane badges, so the palette answered "where did this come from" and never
 * "is this good or bad", which is backwards for a brief.
 */
export type Tone = "good" | "warn" | "bad" | "neutral";

/**
 * Metadata a visible recommendation carries.
 *
 * No confidence field. Confidence labels were removed from the platform on
 * request and should not have been reintroduced here. Evidence state reuses
 * the existing DataLane taxonomy and answers the same question more honestly:
 * a reader wants to know whether a figure is measured or assumed, not how
 * sure we claim to feel about it.
 */
export interface RecommendationMeta {
  horizon: Horizon;
  lane: DataLane;
  lastUpdated: string | null;
}

export interface ScorecardDimension {
  key: string;
  name: string;
  status: string;
  tone: Tone;
  /**
   * The number behind the reading, shown large. Findings were previously
   * buried inside prose sentences, so nothing on the page read as a figure.
   */
  figure: string | null;
  figureCaption: string | null;
  direction: Direction;
  /** One sentence on what the reading means for a buyer. */
  meaning: string;
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
  overall: {
    /** Accelerate / Test / Renegotiate / Monitor / Pause. */
    action: string;
    recommendation: string;
    meta: RecommendationMeta;
  };
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
    tone:
      gaining + slipping === 0 ? "neutral" : netMovers > 0 ? "good" : netMovers < 0 ? "warn" : "neutral",
    figure: gaining + slipping === 0 ? null : `${gaining}:${slipping}`,
    figureCaption: gaining + slipping === 0 ? null : "gaining to slipping",
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
    tone: mScore === null ? "neutral" : mScore >= 70 ? "good" : mScore >= 55 ? "warn" : "bad",
    figure: mScore === null ? null : String(mScore),
    figureCaption: mScore === null ? null : "mean capability maturity",
    lane,
    basis: maturity
      ? `Mean of ${maturity.sourceField} over ${maturity.sampleSize} vendors. No prior period is published, so no direction of travel is shown.`
      : "Not available in the current payload.",
  });

  // 3. Price efficiency: what the last stretch of capability costs.
  //
  // Deliberately not frontier against non-frontier. The frontier flag marks
  // the Pareto-efficient set on the cost/capability curve, not the expensive
  // tier, so that comparison is tautological: the efficient set is cheaper per
  // point because that is what makes it the efficient set. Computing it that
  // way produced a confident, meaningless reading.
  //
  // The question a buyer actually has is what the top model's last increment
  // of capability costs against the cheapest model that gets most of the way.
  // That is answerable from this capture and is the whole tiering argument.
  const priced = models.filter(
    (m) => m.inputPerM > 0 && typeof m.intelligence === "number"
  );
  const best = priced.reduce<CostCapabilityModel | null>(
    (a, m) => (a === null || m.intelligence > a.intelligence ? m : a),
    null
  );
  const NEAR = 0.8;
  const adequate = best
    ? priced.filter((m) => m.intelligence >= best.intelligence * NEAR)
    : [];
  const cheapestAdequate = adequate.length
    ? adequate.reduce((a, m) => (m.inputPerM < a.inputPerM ? m : a))
    : null;
  const ratio =
    best && cheapestAdequate && cheapestAdequate.inputPerM > 0
      ? round1(best.inputPerM / cheapestAdequate.inputPerM)
      : null;
  dims.push({
    key: "price",
    name: "Price efficiency",
    status:
      ratio === null ? "Not published" : ratio >= 5 ? "Favourable" : ratio >= 2 ? "Mixed" : "Tight",
    direction: "unpublished",
    meaning:
      ratio === null || !best || !cheapestAdequate
        ? "Not enough priced models with benchmark scores to compare capability against cost."
        : ratio >= 5
          ? `${adequate.length} models reach 80 per cent of the best benchmark score, and the cheapest costs ${ratio} times less than the top model. Most work does not need the last 20 per cent of capability, and paying for it is the largest avoidable cost in a deployment.`
          : ratio >= 2
            ? `${adequate.length} models reach 80 per cent of the best benchmark score, and the cheapest costs ${ratio} times less than the top model. Worth tiering, though the saving is not dramatic.`
            : `The cheapest model reaching 80 per cent of the best benchmark score costs about the same as the top model, so there is little to gain from tiering on price alone.`,
    tone: ratio === null ? "neutral" : ratio >= 5 ? "good" : ratio >= 2 ? "warn" : "bad",
    figure: ratio === null ? null : `${ratio}\u00d7`,
    figureCaption:
      ratio === null ? null : "cost of the top model over a near-equivalent",
    lane: "derived",
    basis: best && cheapestAdequate
      ? `${priced.length} models with both a published price and a benchmark score. Top score ${best.intelligence} at $${best.inputPerM} per million input tokens; cheapest model within 80 per cent of it is $${cheapestAdequate.inputPerM}. Input price only, and a single capture, so this is a spread and not a trend.`
      : `${priced.length} priced and benchmarked models: not enough to compare.`,
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
    tone: highRisks === null ? "neutral" : highRisks === 0 ? "good" : highRisks <= 3 ? "warn" : "bad",
    figure: highRisks === null ? null : String(highRisks),
    figureCaption: highRisks === null ? null : "open high-severity risks",
    lane,
    basis: riskKpi
      ? `Count of ${riskKpi.sourceField} over ${riskKpi.sampleSize} records.`
      : "Not available in the current payload.",
  });

  // 5. Competitive intensity: how concentrated a typical category is.
  //
  // Concentration is computed inside each category and then summarised across
  // them, never by pooling. Shares are per-category and each category sums to
  // about 100, so taking the three largest across the whole set and adding
  // them produced 118 per cent, which is both impossible and a breach of the
  // rule this app applies everywhere else: compare within a market category,
  // never across one.
  const byCategory = new Map<string, number[]>();
  for (const s of metrics.shares) {
    if (typeof s.estimatedShare !== "number") continue;
    const list = byCategory.get(s.categoryId) ?? [];
    list.push(s.estimatedShare);
    byCategory.set(s.categoryId, list);
  }
  const top3PerCategory = [...byCategory.values()]
    .filter((list) => list.length >= 3)
    .map((list) =>
      [...list].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
    )
    .sort((a, b) => a - b);
  const medianTop3 = top3PerCategory.length
    ? round1(top3PerCategory[Math.floor(top3PerCategory.length / 2)])
    : null;
  dims.push({
    key: "intensity",
    name: "Competitive intensity",
    status:
      medianTop3 === null
        ? "Not published"
        : medianTop3 >= 75
          ? "Concentrated"
          : medianTop3 >= 50
            ? "Moderate"
            : "Fragmented",
    direction: "unpublished",
    meaning:
      medianTop3 === null
        ? "Too few categories carry three or more share estimates to judge concentration."
        : medianTop3 >= 75
          ? `In a typical category the top three vendors hold about ${medianTop3} per cent of estimated share, so there are few real alternatives and correspondingly little pricing leverage.`
          : medianTop3 >= 50
            ? `In a typical category the top three vendors hold about ${medianTop3} per cent of estimated share, leaving credible alternatives to negotiate against.`
            : `In a typical category the top three vendors hold about ${medianTop3} per cent of estimated share, so the field is open and there is real room to negotiate.`,
    tone:
      medianTop3 === null ? "neutral" : medianTop3 >= 75 ? "bad" : medianTop3 >= 50 ? "warn" : "good",
    figure: medianTop3 === null ? null : `${medianTop3}%`,
    figureCaption: medianTop3 === null ? null : "held by the top three, typical category",
    lane,
    basis:
      medianTop3 === null
        ? "Not enough categories with three or more share estimates."
        : `Median across ${top3PerCategory.length} market categories of the combined share held by that category's three largest vendors. Computed inside each category and never pooled, since shares are per-category and do not sum across them. The source publishes no movement for these, so no direction is shown.`,
  });

  // Overall recommendation, assembled from the dimensions rather than asserted
  // over the top of them. It only claims what the readings support.
  const priceFavourable = ratio !== null && ratio >= 5;
  const readinessOk = mScore !== null && mScore >= 55;
  const riskElevated = highRisks !== null && highRisks > 3;

  let overall: string;
  let action: string;
  if (!readinessOk && riskElevated) {
    overall =
      "Hold scope tight. Capability across the tracked set is early and high-severity risks are open, so run contained pilots with named owners rather than committing to a platform.";
    action = "Pause";
  } else if (readinessOk && priceFavourable) {
    overall =
      "Accelerate controlled adoption while applying commercial pressure. Capability is sufficient to deploy against real work, and the cost of the last increment of capability is high enough that matching model tier to task is the largest available saving.";
    action = "Accelerate";
  } else if (readinessOk) {
    overall =
      "Proceed selectively. Capability supports production use, but the price gap between the best model and a near-equivalent is not wide enough to fund tiering on cost alone, so choose on fit and governance.";
    action = "Monitor";
  } else {
    overall =
      "Test before committing. The tracked set is not yet uniformly production-ready, so favour short commitments and re-evaluate as evidence accumulates.";
    action = "Test";
  }

  return {
    scorecard: dims,
    overall: {
      action,
      recommendation: overall,
      meta: {
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
  const improvement = largestPriceImprovement(models);
  const priced = models.filter(
    (m) => m.inputPerM > 0 && typeof m.intelligence === "number"
  );
  const meta = (horizon: Horizon): RecommendationMeta => ({
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
        meta: meta("30 days"),
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
      meta: meta("90 days"),
      unavailable: bestValue ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    {
      slot: "Lowest cost",
      model: cheapest?.model ?? null,
      reason: cheapest
        ? `Cheapest priced model in the capture at $${cheapest.inputPerM} per million input tokens, scoring ${cheapest.intelligence} on the ${benchmarkSource} benchmark.`
        : "",
      fit: "High-volume, low-risk workflows where throughput and unit cost dominate.",
      meta: meta("90 days"),
      unavailable: cheapest ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    {
      slot: "Complex reasoning",
      model: bestReasoning?.model ?? null,
      reason: bestReasoning
        ? `Highest benchmark score in the capture at ${bestReasoning.intelligence}, priced at $${bestReasoning.inputPerM} per million input tokens.`
        : "",
      fit: "Work where a wrong answer is expensive: strategy, complex analysis, regulated decisions.",
      meta: meta("90 days"),
      unavailable: bestReasoning ? null : "Insufficient evidence to make a reliable recommendation.",
    },
    // Computable now that a second price capture exists. The key qualifier is
    // in the reason: nothing was repriced, so this is capability arriving at a
    // lower price point rather than a discount on anything.
    {
      slot: "Largest price-performance improvement",
      model: improvement.best?.model ?? null,
      reason: improvement.best
        ? `Scores ${improvement.best.intelligence} at $${improvement.best.priceNow} per million input tokens. Reaching that level in the ${"2 June 2026"} capture meant ${improvement.best.baselineModel} at $${improvement.best.baselinePrice}, so the same capability now costs ${improvement.best.factor} times less. No model was repriced between the two captures: ${improvement.unchangedCount} of ${improvement.unchangedCount + improvement.repricedCount} models present in both are listed at exactly the same price, so this is new capability arriving underneath the old prices rather than a discount.`
        : "",
      fit: "The clearest case for re-testing a workload you priced earlier in the year. The tier you chose may now be two steps more expensive than it needs to be.",
      meta: meta("90 days"),
      unavailable: improvement.best
        ? null
        : "Insufficient evidence: no model in the later capture both carries a benchmark score and undercuts an earlier option at the same capability.",
    },
    {
      slot: "Priced above evidenced value",
      model: worstValue?.model ?? null,
      reason: worstValue
        ? `At $${worstValue.inputPerM} per million input tokens it returns ${vpd(worstValue)} benchmark points per dollar, the weakest return among models priced at or above the field median.`
        : "",
      fit: "Worth challenging at renewal, or reserving for the narrow cases that justify it.",
      meta: meta("90 days"),
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
      meta: { horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (openRisk) {
    return {
      status: "Pause",
      reason:
        "A high-severity risk is open against this vendor. Resolve it before expanding commitment, whatever the score says.",
      meta: { horizon: "Immediate", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (composite >= 70) {
    return {
      status: "Shortlist",
      reason: `Scores ${composite} against its own market category, near the top of the tracked set.`,
      meta: { horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  if (composite >= 55) {
    return {
      status: "Test",
      reason: `Scores ${composite}: credible enough for a contained pilot, not yet for a platform commitment.`,
      meta: { horizon: "90 days", lane, lastUpdated },
      keyDimensions: dims,
    };
  }
  return {
    status: "Monitor",
    reason: `Scores ${composite} against its category, below the level that would justify a pilot on the published evidence.`,
    meta: { horizon: "12 months", lane, lastUpdated },
    keyDimensions: dims,
  };
}
