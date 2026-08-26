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
import type { AnalystInsightData } from "./insight";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The six dimensions MarketMetrics carries on its own.
 *
 * Observation counts are the whole safety story here. `gaining` and `slipping`
 * are classifications against a previous reading, so they carry two
 * observations and may state a direction. Everything else in this object is a
 * single capture with no prior held, so it is a state and `signal()` strips
 * any direction a caller passes.
 */
export function signalsFromMetrics(m: MarketMetrics): Signal[] {
  const out: Signal[] = [];
  const vendors = m.vendors.filter((v) => v.category !== "AI investor");
  const asOf = m.generatedAt;

  // Capability, as the spread across the assessed set. Narrow means the choice
  // has moved off the model, which is what the capability/price rule needs.
  const scored = vendors
    .map((v) => v.maturity)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => b - a);
  if (scored.length >= 3) {
    const spread = round1(scored[0] - scored[Math.floor(scored.length / 2)]);
    out.push(
      signal({
        id: "capability-spread",
        subject: "the assessed set",
        dimension: "capability",
        state: spread < 15 ? "narrow" : "wide",
        magnitude: spread,
        observedAt: asOf,
        lane: m.lane,
        evidence: {
          claim: `Capability maturity across ${scored.length} assessed vendors spreads ${spread} points between the strongest and the median.`,
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
    out.push(
      signal({
        id: "risk-open",
        subject: high.length > 0 ? high[0].vendorName : "the tracked set",
        dimension: "risk",
        state:
          high.length > 0
            ? `carrying ${high.length} open high-severity ${high.length === 1 ? "finding" : "findings"}`
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

  // Reputation, as the spread across the pillars.
  const reps = vendors
    .map((v) => v.reputation)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => b - a);
  if (reps.length >= 5) {
    const spread = round1(reps[0] - reps[reps.length - 1]);
    out.push(
      signal({
        id: "reputation-spread",
        subject: "the tracked set",
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

  return out;
}

/** Price separation, where a page holds the benchmark and pricing catalogue. */
export function priceSignal(
  ratio: number | null,
  adequate: number,
  observedAt: string | null
): Signal | null {
  if (ratio === null) return null;
  return signal({
    id: "price-separation",
    subject: "the priced and benchmarked catalogue",
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
  signals: readonly Signal[]
): Enriched {
  const found = synthesise(signals);
  if (!insight.decision || found.length === 0) {
    return { insight, synthesis: found, signals: [...signals] };
  }

  const d: Decision = insight.decision;
  const supports = found.filter((s) => s.bearing === "supports");
  const against = found.filter((s) => s.bearing === "against");

  const rebuilt = decide({
    // The action the page computed. Handed straight back to decide(), which
    // means the escalation guard runs over the combined evidence. Synthesis
    // never names an action.
    action: d.action,
    instruction: d.instruction,
    // Why now gains the cross-signal reason where one exists, because "two
    // datasets now disagree" is a better answer to why now than a threshold
    // that has been crossed for a month.
    whyNow:
      found.length > 0
        ? `${d.whyNow} Across datasets: ${found[0].finding}`
        : d.whyNow,
    evidenceFor: [...d.evidenceFor, ...supports.map(synthesisEvidence)],
    evidenceAgainst: [...d.evidenceAgainst, ...against.map(synthesisEvidence)],
    // A contradiction between two datasets is exactly the kind of thing a
    // reader should be told to watch, and it is observable: it resolves when
    // one of the two readings moves.
    trigger:
      against.length > 0
        ? `Either half of this disagreement moving: ${against[0].signals.map((s) => s.evidence.source).join(" or ")}.`
        : d.trigger,
    doNotDo: d.doNotDo,
  });

  return {
    insight: { ...insight, decision: rebuilt },
    synthesis: found,
    signals: [...signals],
  };
}
