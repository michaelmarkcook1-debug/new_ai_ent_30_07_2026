// Turning the datasets this product already holds into normalised signals,
// and feeding what they say together back into the decision.
//
// NO NEW DATA. Every signal below is read off an object a page has already
// fetched. MarketMetrics alone carries six of the ten dimensions, which is why
// most of this file takes one argument. Where a page holds price, disclosure,
// delivery or adoption too, it passes them and more relationships become
// available. A page that holds one dimension produces one signal and no
// synthesis, which is correct and is the common case.
//
// HOW THIS REACHES A RECOMMENDATION, and the limit on it. `enrichWithSynthesis`
// adds each finding to the decision packet as evidence, on the side its bearing
// says, and then calls `decide()` again. That means everything downstream is
// the machinery from the decision tranche: `strengthOf()` sees a contradiction
// and returns "contested", `resolveAction()` refuses to let a committing action
// stand on contested evidence and downgrades it.
//
// So a cross-signal contradiction can weaken a recommendation, and it does so
// THROUGH the deterministic rules rather than around them. Nothing here selects
// an action, and nothing here can strengthen one: `resolveAction()` only ever
// weakens, so the worst a synthesis can do to a reader is make the product less
// certain than it was.

import type { MarketMetrics } from "@/lib/market-metrics";
import { decide, type Decision } from "./decision";
import { signal, type Signal } from "./signals";
import { synthesise, synthesisEvidence, type Synthesis } from "./synthesis";
import { canCreateUrgency } from "./freshness";
import type { AnalystInsightData } from "./insight";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The frontier model cohort, taken from the ranking engine's own taxonomy.
 *
 * NOT an editorial pick here, and deliberately not the vendor row's `category`
 * string. Google's row categorises it as a cloud AI platform and it plainly
 * competes in frontier models; the taxonomy says so and the vendor row does
 * not. `loadFrontierFaceOff()` scopes the Price/Performance face-off from the
 * same category, so the two surfaces are drawn from one definition rather than
 * two that agree by luck.
 */
export function frontierCohort(m: MarketMetrics): Set<string> {
  return new Set(Object.keys(m.categoryComposites["frontier_model_api"] ?? {}));
}

/** Top-to-median spread over a set of scores, or null when too few to judge. */
function spreadOf(scores: readonly number[]): { spread: number; n: number } | null {
  const s = [...scores].sort((a, b) => b - a);
  if (s.length < 3) return null;
  return { spread: round1(s[0] - s[Math.floor(s.length / 2)]), n: s.length };
}

/**
 * The dimensions MarketMetrics carries on its own.
 *
 * Observation counts are the whole safety story here. `gaining` and `slipping`
 * are classifications against a previous reading, so they carry two
 * observations and may state a direction. Everything else in this object is a
 * single capture with no prior held, so it is a state and `signal()` strips
 * any direction a caller passes.
 *
 * Capability and reputation are each emitted TWICE, over two declared
 * populations: once across the whole tracked landscape and once across the
 * frontier model cohort. They are different readings of different markets and
 * the price multiple can only be weighed against the second.
 */
export function signalsFromMetrics(m: MarketMetrics): Signal[] {
  const out: Signal[] = [];
  const vendors = m.vendors.filter((v) => v.category !== "AI investor");
  const asOf = m.generatedAt;
  const cohort = frontierCohort(m);
  const maturityOf = (vs: typeof vendors) =>
    vs.map((v) => v.maturity).filter((n): n is number => typeof n === "number");

  // Capability across the whole tracked landscape. A real reading, and the one
  // Competitive Intelligence wants when it asks how varied the field is.
  //
  // WHAT IT IS NOT is the capability half of the capability/price comparison.
  // This set spans silicon, CRM, service management and sovereign providers,
  // most of which sell nothing a token price could be quoted for, so its
  // spread is a statement about the breadth of the supplier landscape rather
  // than about whether model capability has converged. Declaring the
  // population is what stops it being used as the latter.
  const landscape = spreadOf(maturityOf(vendors));
  if (landscape) {
    out.push(
      signal({
        id: "capability-spread",
        subject: "the assessed set",
        population: "tracked-vendor-set",
        dimension: "capability",
        state: landscape.spread < 15 ? "narrow" : "wide",
        magnitude: landscape.spread,
        observedAt: asOf,
        lane: m.lane,
        evidence: {
          claim: `Capability maturity across ${landscape.n} assessed vendors spreads ${landscape.spread} points between the strongest and the median.`,
          source: "AIE capability matrix",
          basis: "measured",
          lane: m.lane,
          asOf,
        },
      })
    );
  }

  // Capability across the frontier cohort alone. THIS is the reading the price
  // multiple has something to say about, because it is taken over the same
  // market: the vendors whose models are on the benchmark and carry a list
  // price. Narrow here means the choice has moved off the model, which is what
  // the capability/price rule needs and what the landscape spread cannot tell
  // it.
  const frontier = spreadOf(maturityOf(vendors.filter((v) => cohort.has(v.id))));
  if (frontier) {
    out.push(
      signal({
        id: "capability-spread-frontier",
        subject: "the frontier model cohort",
        population: "frontier-model-providers",
        dimension: "capability",
        state: frontier.spread < 15 ? "narrow" : "wide",
        magnitude: frontier.spread,
        observedAt: asOf,
        lane: m.lane,
        evidence: {
          claim: `Capability maturity across ${frontier.n} frontier model providers spreads ${frontier.spread} points between the strongest and the median.`,
          source: "AIE capability matrix",
          basis: "measured",
          lane: m.lane,
          asOf,
        },
      })
    );
  }

  // Position, as the most defensible lead the assessment holds.
  let best: { vendor: string; gap: number; category: string } | null = null;
  const nameOf = new Map(m.vendors.map((v) => [v.id, v.name]));
  for (const [categoryId, placements] of Object.entries(m.categoryComposites)) {
    const ranked = Object.entries(placements).sort((a, b) => a[1].rank - b[1].rank);
    if (ranked.length < 2) continue;
    const gap = round1(ranked[0][1].composite - ranked[1][1].composite);
    if (!best || gap > best.gap) {
      best = {
        vendor: nameOf.get(ranked[0][0]) ?? ranked[0][0],
        gap,
        category: categoryId,
      };
    }
  }
  if (best) {
    out.push(
      signal({
        id: "position-lead",
        subject: best.vendor,
        population: "tracked-vendor-set",
        members: [best.vendor],
        dimension: "position",
        // "clear" is what the concentration rule looks for; "leads" is what the
        // strength/risk rule looks for. Both are true of a defensible lead.
        state: best.gap >= 0.25 ? "clear, and leads its market" : "leads narrowly",
        magnitude: best.gap,
        observedAt: m.compositesCapturedAt,
        lane: m.lane,
        evidence: {
          claim: `${best.vendor} holds the widest lead in the assessment, ${best.gap} points clear of the runner-up in its market.`,
          source: "AIE vendor rankings",
          basis: "measured",
          lane: m.lane,
          asOf: m.compositesCapturedAt,
        },
      })
    );
  }

  // Concentration, from the share estimates. Modelled, and labelled as such.
  const byCategory = new Map<string, number[]>();
  for (const s of m.shares) {
    if (typeof s.estimatedShare !== "number") continue;
    const list = byCategory.get(s.categoryId) ?? [];
    list.push(s.estimatedShare);
    byCategory.set(s.categoryId, list);
  }
  const tops = [...byCategory.values()]
    .filter((l) => l.length >= 3)
    .map((l) => [...l].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0))
    .sort((a, b) => a - b);
  if (tops.length > 0) {
    const median = round1(tops[Math.floor(tops.length / 2)]);
    out.push(
      signal({
        id: "concentration",
        subject: "a typical tracked category",
        population: "tracked-vendor-set",
        dimension: "concentration",
        state: median >= 70 ? "tight" : "spread",
        magnitude: median,
        observedAt: m.shareAsOf ?? asOf,
        lane: m.lane,
        evidence: {
          claim: `The three largest vendors hold about ${median} per cent of a typical tracked category, across ${tops.length} categories with enough estimates to judge.`,
          source: "AIE market share estimates",
          // The dataset says so itself: a directional category-presence
          // estimate, not measured revenue.
          basis: "modelled",
          lane: m.lane,
          asOf: m.shareAsOf ?? asOf,
        },
      })
    );
  }

  // Risk. An open high-severity finding is the thing that contradicts a
  // ranking, so the state says "open" and "high" where one exists.
  const high = m.risks.filter((r) => (r.severity ?? "").toLowerCase() === "high");
  if (m.risks.length > 0) {
    const affected = new Set(m.risks.map((r) => r.vendorId)).size;
    const highVendors = [...new Set(high.map((r) => r.vendorName))];
    out.push(
      signal({
        id: "risk-open",
        // A register-level reading, and named as one. This carried the first
        // high-severity vendor's name beside a count of every vendor's
        // findings, which read as though that one company held all six.
        subject: "the tracked set",
        population: "tracked-vendor-set",
        // Every vendor carrying an open high-severity finding, not just the
        // first. The strength/risk rule has to establish that the vendor it is
        // about is the same on both sides, and naming one of six made that
        // impossible: it paired the assessment's strongest leader with
        // whichever unrelated company happened to sort first on the register.
        members: highVendors,
        dimension: "risk",
        state:
          high.length > 0
            ? `carrying ${high.length} open high-severity ${high.length === 1 ? "finding" : "findings"} across ${highVendors.length} ${highVendors.length === 1 ? "vendor" : "vendors"}`
            : "carrying no open high-severity finding",
        observedAt: asOf,
        lane: m.lane,
        evidence: {
          claim: `${m.risks.length} open ${m.risks.length === 1 ? "risk" : "risks"} against tracked vendors, ${high.length} high severity, touching ${affected} ${affected === 1 ? "vendor" : "vendors"}.`,
          source: "AIE risk register",
          basis: "measured",
          lane: m.lane,
          asOf,
        },
      })
    );
  }

  // Movement. THE ONLY DIMENSION HERE THAT MAY STATE A DIRECTION, because it
  // is the only one classified against a previous reading. Gated further by
  // shareMovementPublished: when the source republishes identical priors there
  // is no movement to report and treating the classification as change would
  // be manufacturing a trend out of a repeated snapshot.
  if (m.shareMovementPublished && (m.gaining.length > 0 || m.slipping.length > 0)) {
    const net = m.gaining.length - m.slipping.length;
    out.push(
      signal({
        id: "movement",
        subject: "the tracked set",
        population: "tracked-vendor-set",
        dimension: "movement",
        state:
          net > 0 ? "gaining on balance" : net < 0 ? "slipping on balance" : "mixed",
        direction: net > 0 ? "up" : net < 0 ? "down" : "flat",
        magnitude: Math.abs(net),
        observations: 2,
        observedAt: m.shareAsOf ?? asOf,
        lane: m.lane,
        evidence: {
          claim: `${m.gaining.length} vendors classified as gaining position and ${m.slipping.length} as slipping, against the previous reading.`,
          source: "AIE vendor movement classification",
          basis: "modelled",
          lane: m.lane,
          asOf: m.shareAsOf ?? asOf,
        },
      })
    );
  }

  // Reputation, as the spread across the pillars. Emitted twice for the same
  // reason capability is: the commercial trade-off rule weighs a price
  // separation against reputation and says outright that both are read "across
  // the same set", which is only true of the frontier-scoped reading.
  const repOf = (vs: typeof vendors) =>
    vs
      .map((v) => v.reputation)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => b - a);

  const reps = repOf(vendors);
  if (reps.length >= 5) {
    const spread = round1(reps[0] - reps[reps.length - 1]);
    out.push(
      signal({
        id: "reputation-spread",
        subject: "the tracked set",
        population: "tracked-vendor-set",
        dimension: "reputation",
        state: spread > 25 ? "widely spread, with a weak tail" : "tightly banded",
        magnitude: spread,
        observedAt: m.reputationAsOf ?? asOf,
        lane: m.lane,
        evidence: {
          claim: `Reputation across ${reps.length} vendors spreads ${spread} points between the highest and lowest reading.`,
          source: "AIE reputation pillars",
          basis: "measured",
          lane: m.lane,
          asOf: m.reputationAsOf ?? asOf,
        },
      })
    );
  }

  const fReps = repOf(vendors.filter((v) => cohort.has(v.id)));
  if (fReps.length >= 5) {
    const spread = round1(fReps[0] - fReps[fReps.length - 1]);
    out.push(
      signal({
        id: "reputation-spread-frontier",
        subject: "the frontier model cohort",
        population: "frontier-model-providers",
        dimension: "reputation",
        state: spread > 25 ? "widely spread, with a weak tail" : "tightly banded",
        magnitude: spread,
        observedAt: m.reputationAsOf ?? asOf,
        lane: m.lane,
        evidence: {
          claim: `Reputation across ${fReps.length} frontier model providers spreads ${spread} points between the highest and lowest reading.`,
          source: "AIE reputation pillars",
          basis: "measured",
          lane: m.lane,
          asOf: m.reputationAsOf ?? asOf,
        },
      })
    );
  }

  return out;
}

/**
 * Price separation, where a page holds the benchmark and pricing catalogue.
 *
 * Declared as a frontier-model-provider reading because that is what it
 * measures: the multiple runs between the top-scoring model and the cheapest
 * model still within 80 per cent of it, and both endpoints sit inside the
 * frontier cohort. It is the price half of the capability/price comparison and
 * may only meet a capability reading taken over the same market.
 */
export function priceSignal(
  ratio: number | null,
  adequate: number,
  observedAt: string | null
): Signal | null {
  if (ratio === null) return null;
  return signal({
    id: "price-separation",
    subject: "the priced and benchmarked catalogue",
    population: "frontier-model-providers",
    dimension: "price",
    state: ratio >= 5 ? "wide, and separated from capability" : "narrow",
    magnitude: ratio,
    observedAt,
    lane: "derived",
    evidence: {
      claim: `The cheapest of ${adequate} models reaching 80 per cent of the top benchmark score costs ${ratio} times less than the top model on published input pricing.`,
      source: "Artificial Analysis benchmark",
      basis: "measured",
      lane: "derived",
      asOf: observedAt,
    },
  });
}

/** What the filings do and do not quantify. */
export function disclosureSignal(
  disclosing: number,
  total: number,
  observedAt: string | null
): Signal | null {
  if (total === 0) return null;
  const undisclosed = total - disclosing;
  return signal({
    id: "disclosure",
    subject: "tracked public vendors",
    population: "tracked-public-vendors",
    dimension: "disclosure",
    state: undisclosed > disclosing ? "mostly undisclosed" : "mostly disclosed",
    magnitude: Math.round((disclosing / total) * 100),
    observedAt,
    lane: "aie",
    evidence: {
      claim: `${disclosing} of ${total} tracked public vendors state a quantified AI revenue figure in their filings.`,
      source: "SEC filings, full-text search",
      basis: "measured",
      lane: "aie",
      asOf: observedAt,
    },
  });
}

/** Whether anyone other than one firm can stand the thing up. */
export function deliverySignal(
  soleSourced: number,
  nodes: number,
  edges: number,
  observedAt: string | null
): Signal | null {
  if (edges === 0) return null;
  return signal({
    id: "delivery-breadth",
    subject: "the tracked delivery channel",
    population: "tracked-delivery-channel",
    dimension: "delivery",
    state:
      soleSourced > 0
        ? `sole-sourced for ${soleSourced} ${soleSourced === 1 ? "vendor" : "vendors"}`
        : "competitive across every tracked vendor",
    magnitude: soleSourced,
    observedAt,
    lane: "aie",
    evidence: {
      claim: `${nodes} delivery firms carry ${edges} tracked vendor relationships, ${soleSourced} of which have a single firm able to deliver them.`,
      source: "AIE exposure map",
      basis: "measured",
      lane: "aie",
      asOf: observedAt,
    },
  });
}

/**
 * Enterprise uptake.
 *
 * The dataset describes itself as a directional segment-share model and says
 * outright that it is not audited market share, so the basis is "modelled" and
 * nothing built on it may be stated as measured.
 */
export function adoptionSignal(
  leader: string,
  share: number,
  observedAt: string | null
): Signal {
  return signal({
    id: "adoption",
    subject: leader,
    population: "tracked-vendor-set",
    members: [leader],
    dimension: "adoption",
    state: share >= 0.2 ? "high, and concentrated" : "spread across the field",
    magnitude: round1(share * 100),
    observedAt,
    lane: "aie",
    evidence: {
      claim: `${leader} carries ${round1(share * 100)} per cent of the observed enterprise adoption signal.`,
      source: "AIE uptake model",
      basis: "modelled",
      lane: "aie",
      asOf: observedAt,
    },
  });
}

export interface Enriched {
  insight: AnalystInsightData;
  synthesis: Synthesis[];
  signals: Signal[];
}

/**
 * Fold cross-signal findings into a page's decision packet.
 *
 * Returns the insight unchanged when there is no packet to enrich or nothing
 * fired. An insufficient-evidence page has no packet by construction, so
 * synthesis cannot conjure a recommendation onto one, which is the property
 * the whole decision tranche rests on.
 *
 * The rebuilt packet goes back through `decide()` rather than being mutated,
 * so the strength is recomputed from the new evidence and the action is put
 * back through the escalation guard. That is the only route by which any of
 * this reaches a reader's recommendation.
 */
export function enrichWithSynthesis(
  insight: AnalystInsightData,
  signals: readonly Signal[],
  /** The moment freshness is judged against. Passed by tests. */
  now: number = Date.now()
): Enriched {
  const found = synthesise(signals, now);
  if (!insight.decision || found.length === 0) {
    return { insight, synthesis: found, signals: [...signals] };
  }

  const d: Decision = insight.decision;
  const supports = found.filter((s) => s.bearing === "supports");
  const against = found.filter((s) => s.bearing === "against");
  // What may answer "why now", on two independent tests.
  //
  // BEARING. Why now is the case for acting, so only a finding that argues FOR
  // the recommendation may appear there. This filtered on currency alone, and
  // the result was that a contradiction current enough to matter was copied
  // verbatim into both halves: the reader was shown the same sentence as the
  // reason to move and as the reason not to. A finding that argues against
  // acting is a reason for caution, it reaches the packet through
  // evidenceAgainst, and it contests the strength there. It is never also a
  // reason to hurry.
  //
  // FRESHNESS, on the stricter of the two tests. `currency` asks whether the
  // finding may be spoken of at all, and admits an aging reading; urgency asks
  // whether it may be the reason to move this week, and does not. A finding
  // resting on a benchmark last refreshed over a full release cycle ago is
  // real evidence about the decision and is not news, and the product has
  // already shipped the mistake of treating the two as one question.
  const urgent = found.filter(
    (s) => s.bearing === "supports" && canCreateUrgency(s.freshness)
  );

  const rebuilt = decide({
    // The action the page computed. Handed straight back to decide(), which
    // means the escalation guard runs over the combined evidence. Synthesis
    // never names an action.
    action: d.action,
    instruction: d.instruction,
    // Why now gains the cross-signal reason where a supporting one exists,
    // because "two datasets independently point the same way, now" is a better
    // answer to why now than a threshold that has been crossed for a month.
    whyNow:
      urgent.length > 0
        ? `${d.whyNow} Across datasets: ${urgent[0].finding}`
        : d.whyNow,
    evidenceFor: [...d.evidenceFor, ...supports.map(synthesisEvidence)],
    evidenceAgainst: [...d.evidenceAgainst, ...against.map(synthesisEvidence)],
    // A contradiction between two datasets is exactly the kind of thing a
    // reader should be told to watch, and it is observable: it resolves when
    // one of the two readings moves.
    // A trigger says what to watch for, so it may only be built from a
    // disagreement that is live. A contextual contradiction is worth knowing
    // and is not something to watch resolve.
    trigger:
      against.some((s) => s.currency === "current")
        ? `Either half of this disagreement moving: ${against.find((s) => s.currency === "current")!.signals.map((x) => x.evidence.source).join(" or ")}.`
        : d.trigger,
    doNotDo: d.doNotDo,
  });

  return {
    insight: { ...insight, decision: rebuilt },
    synthesis: found,
    signals: [...signals],
  };
}
