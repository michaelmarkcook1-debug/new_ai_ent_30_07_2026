// Cross-signal synthesis: the conclusions that are not on any one page.
//
// Capability converging is a Competitive Intel fact. Price staying separated
// is a Price/Performance fact. Together they say something neither says alone,
// and until now nothing in this product could see it because the two pages
// never met.
//
// EIGHT RELATIONSHIPS, NOT A RULE ENGINE. Each one below names the exact
// dimensions and states it needs and returns nothing when they are absent.
// There is no scoring, no weighting, no inference over rules. A relationship
// either has its inputs or it does not fire, and the ones that fire carry the
// signals that produced them so a reader can walk back to the dataset.
//
// CORRELATION IS NOT CAUSALITY, and this is enforced rather than asked for.
// The `Relation` vocabulary has four members and none of them is causal:
// reinforces, contradicts, coincides with, consistent with. Two signals moving
// together get "coincides with", which is a statement about two timestamps.
// `CAUSAL_WORDS` below is asserted against every finding this module produces
// and against the prompt block, so a sentence claiming one thing drove another
// fails the suite rather than reaching a reader.
//
// WHAT IT MAY DO TO A DECISION. It contributes evidence, on either side, and
// nothing else. A contradicting synthesis becomes `evidenceAgainst`, which
// makes `strengthOf()` return "contested", which makes `resolveAction()`
// downgrade a committing action. So synthesis can weaken a recommendation and
// can sharpen its wording, and cannot select an action, because it never
// touches one. The deterministic rules stay exactly where they were.

import type { DecisionEvidence } from "./decision";
import { speaksToNow, worstFreshness, type Freshness } from "./freshness";
import {
  coincident,
  hasTrend,
  samePopulation,
  stateWording,
  temporalClass,
  worstLane,
  POPULATION_LABEL,
  type Signal,
  type SignalDimension,
  type TemporalClass,
} from "./signals";

/**
 * How two readings relate. None of these is causal, deliberately.
 *
 *   reinforces      they point the same way and compound
 *   contradicts     they point opposite ways, or one limits the other
 *   coincides with  they changed in the same window. Nothing more is claimed
 *   consistent with one is what you would expect given the other, without
 *                   either establishing the other
 */
export type Relation =
  | "reinforces"
  | "contradicts"
  | "coincides with"
  | "consistent with";

/**
 * Words that assert cause. Checked against every finding and implication.
 *
 * The product holds co-movement and never establishes mechanism, so any
 * sentence reaching for one of these is claiming more than the data carries.
 * Tested rather than trusted: a rule author who writes "drove" gets a failing
 * suite rather than a plausible sentence in front of a buyer.
 */
export const CAUSAL_WORDS: readonly string[] = [
  "caused",
  "causes",
  "causing",
  "drove",
  "driven by",
  "drives",
  "led to",
  "leads to",
  "resulted in",
  "results in",
  "because of",
  "as a result of",
  "explains",
  "explained by",
  "due to",
  "triggered",
  "produced by",
];

export function claimsCausality(text: string): string[] {
  const t = text.toLowerCase();
  return CAUSAL_WORDS.filter((w) =>
    new RegExp(`(^|[^a-z])${w.replace(/ /g, "\\s+")}([^a-z]|$)`).test(t)
  );
}

export interface Synthesis {
  id: string;
  relation: Relation;
  /** What the combination shows, stated deterministically. */
  finding: string;
  /** What it means for the decision on the page. */
  implication: string;
  /** Every signal that produced it. Traceability is not optional. */
  signals: Signal[];
  /** The strongest temporal claim the inputs support, never more. */
  temporal: TemporalClass;
  /**
   * Whether this may be spoken of as a reading of the present.
   *
   *   current     every input still speaks to now, so this may drive a why now
   *   contextual  at least one input is stale or undated. The finding still
   *               holds as background and may NOT create urgency
   *
   * A rule whose conclusion depends on currency is suppressed outright rather
   * than downgraded, because "these two are moving in opposite directions" is
   * not a weaker claim when one of the readings is three months old, it is a
   * different and false one.
   */
  currency: "current" | "contextual";
  /** The least fresh input, which is the one that governs. */
  freshness: Freshness;
  /**
   * Whether this argues for the page's recommendation or against it.
   *
   * "against" is how a synthesis reaches the decision packet: it becomes
   * evidenceAgainst, which contests the strength, which can downgrade a
   * committing action through the existing guard. It is never allowed to
   * pick an action itself.
   */
  bearing: "supports" | "against";
}

// ------------------------------------------------------------------ helpers

const find = (signals: readonly Signal[], d: SignalDimension) =>
  signals.find((s) => s.dimension === d) ?? null;

/**
 * A reading on this dimension taken over the same universe as `like`.
 *
 * The selector the like-for-like rules use instead of `find`. Where a page
 * emits both a landscape and a frontier-scoped capability reading, this picks
 * the one that can actually be compared against the price reading rather than
 * whichever was pushed first.
 */
const findComparable = (
  signals: readonly Signal[],
  d: SignalDimension,
  like: Signal
) => signals.find((s) => s.dimension === d && samePopulation(s, like)) ?? null;

const has = (s: Signal | null, ...states: string[]) =>
  s !== null && states.some((x) => s.state.toLowerCase().includes(x));

/** The strongest temporal claim a set of inputs supports. */
function jointTemporal(signals: readonly Signal[]): TemporalClass {
  // The weakest input governs. A change combined with a snapshot is a
  // statement about a snapshot, because half of it cannot move.
  let weakest: TemporalClass = "acceleration";
  const rank: Record<TemporalClass, number> = {
    state: 0,
    change: 1,
    acceleration: 2,
  };
  for (const s of signals) {
    const t = temporalClass(s);
    if (rank[t] < rank[weakest]) weakest = t;
  }
  return signals.length === 0 ? "state" : weakest;
}

interface Rule {
  id: string;
  relation: Relation;
  bearing: "supports" | "against";
  /**
   * True where the conclusion is a claim about the present.
   *
   * Movement rules are the clear case: a stale movement reading is not weaker
   * evidence of movement, it is evidence of movement that has since stopped
   * being observed. Structural rules are the other case: a ranking beside an
   * open finding says the same thing whether the register was read last week
   * or last quarter, and registers lag by construction anyway.
   */
  requiresCurrency: boolean;
  /**
   * True where the rule weighs one measurement against another and so needs
   * both to have been taken over the same universe.
   *
   * Enforced in `synthesise` as well as in the rule's own `match`, because
   * this is the guard the previous audit went through: a capability spread
   * over 43 vendors spanning silicon, CRM and service management was being
   * weighed against a price multiple over frontier language models, and the
   * combined sentence described a market nobody had measured. A rule that
   * compares like with like must say so, and a reading that has not declared
   * its population cannot satisfy it.
   */
  requiresSamePopulation: boolean;
  /**
   * True where the rule's conclusion is about one named company.
   *
   * "This vendor leads and carries an open finding" is only a contradiction
   * when both halves are about the same vendor. Without this the rule paired
   * the assessment's strongest leader with whichever unrelated company sorted
   * first on the risk register and told the reader to attach one's findings to
   * the other's shortlist entry.
   */
  requiresSameSubject: boolean;
  /** The signals this needs, or null when they are not present. */
  match(signals: readonly Signal[]): Signal[] | null;
  finding(matched: Signal[]): string;
  implication(matched: Signal[]): string;
}

// ------------------------------------------------------------------- rules
//
// Eight, each defensible from a dataset this product already holds. Adding a
// ninth means finding a ninth pair of sources that genuinely disagree or
// genuinely compound, not thinking of another sentence worth saying.

const RULES: readonly Rule[] = [
  // 5. Capability and price divergence. The single most consequential
  // combination in enterprise AI buying, and it lives on two different tabs.
  {
    id: "capability-price-divergence",
    relation: "reinforces",
    bearing: "supports",
    // "The premium is being paid into a market where the lead has narrowed" is
    // a claim about the market now. On a stale benchmark it is a claim about
    // the market in July.
    requiresCurrency: true,
    // The price multiple is taken over frontier models. The capability reading
    // it meets must be taken over the same market, or the sentence compares a
    // premium paid for a model against the breadth of a supplier landscape
    // that mostly does not sell models.
    requiresSamePopulation: true,
    requiresSameSubject: false,
    match(signals) {
      const price = find(signals, "price");
      if (!price) return null;
      const cap = findComparable(signals, "capability", price);
      if (!cap) return null;
      if (!has(cap, "narrow", "converged")) return null;
      if (!has(price, "wide", "separated")) return null;
      return [cap, price];
    },
    finding([cap, price]) {
      return `Capability across ${POPULATION_LABEL[cap.population]} ${stateWording(cap)}, while the price separation between the top model and a qualifying alternative ${stateWording(price)}. The two readings come from different datasets, taken over the same set of vendors, and point the same way.`;
    },
    implication() {
      return `A premium priced against a capability lead is being paid into a market where that lead has narrowed. That is a commercial argument before it is a technical one, and it is available at renewal rather than at redesign.`;
    },
  },

  // 6. Strength and risk divergence. The assessment scores evidenced
  // capability and does not net off governance exposure, so a vendor can rank
  // well and still be the wrong commitment this quarter.
  {
    id: "strength-risk-divergence",
    relation: "contradicts",
    bearing: "against",
    // Structural. The assessment does not net off governance exposure, and it
    // did not do so last quarter either.
    requiresCurrency: false,
    requiresSamePopulation: false,
    // Both halves must be about the same company. See below.
    requiresSameSubject: true,
    match(signals) {
      const pos = find(signals, "position");
      const risk = find(signals, "risk");
      if (!pos || !risk) return null;
      if (!has(pos, "leads", "top", "clear")) return null;
      if (!has(risk, "open", "high")) return null;
      // The leader has to be one of the vendors actually carrying a finding.
      // Without this the rule fired on any leader beside any risk-carrying
      // vendor: it read the assessment's widest lead in workflow automation
      // beside a silicon vendor's open findings and told the reader to attach
      // the second's remediation position to the first's shortlist entry.
      // Two unrelated companies in two unrelated markets is not a
      // contradiction, and stating it as one is worse than saying nothing.
      if (!risk.members.includes(pos.subject)) return null;
      return [pos, risk];
    },
    finding([pos, risk]) {
      const n = risk.members.length;
      return `On the assessment ${pos.subject} ${stateWording(pos)}, and the risk register records ${pos.subject} among the ${n} ${n === 1 ? "vendor" : "vendors"} carrying an open high-severity finding. The assessment measures evidenced capability and does not subtract governance exposure, so the two readings are not reconciled anywhere upstream.`;
    },
    implication([pos]) {
      return `A shortlist drawn on the ranking alone will carry ${pos.subject} without the finding attached to it. The remediation position belongs in the evaluation, not after it.`;
    },
  },

  // 7. Adoption and delivery divergence. Buying what everyone is buying is
  // only a safe decision if somebody can stand it up.
  {
    id: "adoption-delivery-divergence",
    relation: "contradicts",
    bearing: "against",
    // Delivery capacity is built out of trained people and moves over years.
    requiresCurrency: false,
    // Demand and the capacity to implement it are different measurements of
    // different things, which is the point of the rule rather than a defect
    // in it, so no same-population requirement applies.
    requiresSamePopulation: false,
    requiresSameSubject: false,
    match(signals) {
      const adopt = find(signals, "adoption");
      const delivery = find(signals, "delivery");
      if (!adopt || !delivery) return null;
      if (!has(adopt, "high", "leading", "concentrated")) return null;
      if (!has(delivery, "sole", "single", "narrow")) return null;
      return [adopt, delivery];
    },
    finding([adopt, delivery]) {
      return `Adoption signal ${stateWording(adopt)} for ${adopt.subject}, while delivery capacity ${stateWording(delivery)}. Demand and the ability to implement it are recorded in different datasets and do not agree.`;
    },
    implication() {
      return `Where one firm carries the work, the terms negotiated with the vendor are not the terms the engagement will be priced at. A second delivery route is worth establishing before the software decision closes, not after.`;
    },
  },

  // 8. Concentration and alternative supply. Leverage is the thing that
  // disappears quietly between one renewal and the next.
  {
    id: "concentration-alternatives",
    relation: "reinforces",
    bearing: "against",
    requiresCurrency: false,
    // Both halves are readings of the tracked assessment already, and the rule
    // compares a category's share against that category's leader rather than
    // one measurement against another taken elsewhere.
    requiresSamePopulation: false,
    requiresSameSubject: false,
    match(signals) {
      const conc = find(signals, "concentration");
      const pos = find(signals, "position");
      if (!conc || !pos) return null;
      if (!has(conc, "tight", "concentrated")) return null;
      if (!has(pos, "clear", "unassailable", "decisive")) return null;
      return [conc, pos];
    },
    finding([conc, pos]) {
      return `Category share ${stateWording(conc)}, and the assessment shows ${pos.subject} ${stateWording(pos)}. Concentration and a defensible lead are separate measurements pointing at the same shortened field.`;
    },
    implication() {
      return `The negotiating position here is weaker than the assessment alone suggests, and it weakens further the longer no alternative is kept current. The cost of having no second option appears at renewal rather than at deployment.`;
    },
  },

  // 4. Commercial trade-off: the cheapest option carrying the worst
  // post-contract experience. Two datasets that measure different halves of
  // what a buyer actually signs up to.
  {
    id: "commercial-tradeoff",
    relation: "contradicts",
    bearing: "against",
    // Half of it is a price reading, and a stale price is not a trade-off
    // anyone faces today.
    requiresCurrency: true,
    // The finding says "across the same set" in as many words, so the two
    // readings had better be over the same set. A reputation spread taken
    // across every tracked supplier says nothing about the vendor whose model
    // the price separation is pointing at.
    requiresSamePopulation: true,
    requiresSameSubject: false,
    match(signals) {
      const price = find(signals, "price");
      if (!price) return null;
      const rep = findComparable(signals, "reputation", price);
      if (!rep) return null;
      if (!has(price, "wide", "separated", "cheap")) return null;
      if (!has(rep, "weak", "low", "trailing", "spread")) return null;
      return [price, rep];
    },
    finding([price, rep]) {
      return `Price separation ${stateWording(price)}, and reputation across the same set of ${POPULATION_LABEL[rep.population]} ${stateWording(rep)}. Reputation measures support, documentation and post-contract behaviour, none of which appears in a price or a capability score.`;
    },
    implication() {
      return `The saving available by moving down a tier is real and is not the whole cost. Reputation is the slowest tracked measure to move, so a support problem bought at renewal will still be there at the next one.`;
    },
  },

  // 1. Generic reinforcement: two dated readings from different datasets
  // moving the same way. Deliberately last of the specific rules, so a named
  // relationship above wins where one applies.
  {
    id: "reinforcing-movement",
    relation: "reinforces",
    bearing: "supports",
    requiresCurrency: true,
    requiresSamePopulation: false,
    requiresSameSubject: false,
    match(signals) {
      const moving = signals.filter(hasTrend);
      for (let i = 0; i < moving.length; i++) {
        for (let j = i + 1; j < moving.length; j++) {
          const a = moving[i];
          const b = moving[j];
          if (a.dimension === b.dimension) continue;
          if (a.direction !== b.direction) continue;
          if (a.evidence.source === b.evidence.source) continue;
          return [a, b];
        }
      }
      return null;
    },
    finding([a, b]) {
      return `${a.subject} ${stateWording(a)} on ${a.dimension}, and ${b.subject} ${stateWording(b)} on ${b.dimension}. Two datasets, recorded separately, moving the same way.`;
    },
    implication() {
      return `Two independent readings agreeing is a different kind of evidence from one reading repeated, and it is the condition under which acting on a direction of travel is defensible at all.`;
    },
  },

  // 2. Generic contradiction: two dated readings from different datasets
  // moving opposite ways. This is the one that must never be quietly dropped.
  {
    id: "contradictory-movement",
    relation: "contradicts",
    bearing: "against",
    requiresCurrency: true,
    requiresSamePopulation: false,
    requiresSameSubject: false,
    match(signals) {
      const moving = signals.filter(hasTrend);
      for (let i = 0; i < moving.length; i++) {
        for (let j = i + 1; j < moving.length; j++) {
          const a = moving[i];
          const b = moving[j];
          if (a.dimension === b.dimension) continue;
          const opposed =
            (a.direction === "up" && b.direction === "down") ||
            (a.direction === "down" && b.direction === "up");
          if (!opposed) continue;
          return [a, b];
        }
      }
      return null;
    },
    finding([a, b]) {
      return `${a.subject} ${stateWording(a)} on ${a.dimension}, while ${b.subject} ${stateWording(b)} on ${b.dimension}. The two readings point opposite ways and this product does not reconcile them.`;
    },
    implication() {
      return `A recommendation resting on either reading alone would be stronger than the evidence as a whole supports. The disagreement is the finding, and it is a reason to establish which reading holds before committing rather than to pick the convenient one.`;
    },
  },

  // 3. Simultaneous change. The most dangerous rule in the file, because
  // "these two moved together" is one careless verb away from "this moved
  // that". The relation is fixed at "coincides with" and the prose says
  // outright that no mechanism is established.
  {
    id: "simultaneous-change",
    relation: "coincides with",
    bearing: "supports",
    // The most currency-dependent of the lot: "both moved inside the same
    // window" means nothing if the window closed a season ago.
    requiresCurrency: true,
    requiresSamePopulation: false,
    requiresSameSubject: false,
    match(signals) {
      const moving = signals.filter(hasTrend);
      for (let i = 0; i < moving.length; i++) {
        for (let j = i + 1; j < moving.length; j++) {
          const a = moving[i];
          const b = moving[j];
          if (a.dimension === b.dimension) continue;
          if (!coincident(a, b)) continue;
          return [a, b];
        }
      }
      return null;
    },
    finding([a, b]) {
      return `${a.subject} on ${a.dimension} and ${b.subject} on ${b.dimension} both moved inside the same window. This product records that they coincided and establishes no mechanism between them.`;
    },
    implication() {
      return `Two things moving together is worth watching and is not evidence that either moved the other. Treat it as a prompt to check whether one is a leading indicator for you, not as a finding that it is.`;
    },
  },
];

/**
 * Every relationship the signals actually support.
 *
 * Rules are evaluated in order and the specific ones come first, so a
 * capability and price pair is reported as capability/price divergence rather
 * than as generic reinforcement. A rule whose inputs are absent contributes
 * nothing: there is no partial firing and no default.
 */
export function synthesise(
  signals: readonly Signal[],
  /**
   * The moment currency is judged against. Passed by callers so the behaviour
   * is deterministic and testable; defaults to now in a render.
   */
  now: number = Date.now()
): Synthesis[] {
  const out: Synthesis[] = [];
  const claimed = new Set<string>();

  for (const rule of RULES) {
    const matched = rule.match(signals);
    if (!matched || matched.length === 0) continue;

    // Comparability, enforced here as well as in the rule's own match.
    //
    // The rules select their own inputs and could each get this right, and one
    // of them getting it wrong is how the product shipped a sentence weighing
    // a capability spread over 43 vendors against a price multiple over
    // frontier models. So the invariant lives in one place that every rule
    // passes through, and a rule that declares it compares like with like
    // cannot emit a finding over two populations regardless of what its match
    // returned. An undeclared population fails this, which is the point:
    // a reading nobody has scoped is not thereby scoped to whatever it met.
    if (rule.requiresSamePopulation) {
      const [first] = matched;
      if (!matched.every((s) => samePopulation(s, first))) continue;
    }

    // The same check at vendor level, for a rule whose conclusion is about one
    // named company: at least one company must be named by EVERY matched
    // reading. An intersection rather than a union, because a union is
    // satisfied by two readings about two different companies, which is
    // exactly the pairing this exists to refuse.
    if (rule.requiresSameSubject) {
      const named = matched.map(
        (s) => new Set(s.members.length > 0 ? s.members : [s.subject])
      );
      const shared = [...named[0]].some((name) => named.every((n) => n.has(name)));
      if (!shared) continue;
    }

    // Freshness eligibility. A rule whose conclusion is a claim about the
    // present does not fire at all on evidence that cannot speak to the
    // present, and an undated reading counts as unable rather than as fresh.
    const freshness = worstFreshness(matched, now);
    const current = speaksToNow(freshness);
    if (rule.requiresCurrency && !current) continue;

    // A signal already used by a more specific rule does not get reused by a
    // generic one, so the same two readings cannot produce two findings that
    // say the same thing in different words.
    const key = matched.map((s) => s.id).sort().join("|");
    if (claimed.has(key)) continue;
    if (matched.every((s) => claimed.has(s.id))) continue;
    claimed.add(key);
    for (const s of matched) claimed.add(s.id);

    out.push({
      id: rule.id,
      relation: rule.relation,
      finding: rule.finding(matched),
      implication: rule.implication(matched),
      signals: matched,
      temporal: jointTemporal(matched),
      bearing: rule.bearing,
      currency: current ? "current" : "contextual",
      freshness,
    });
  }
  return out;
}

/**
 * A synthesis as evidence the decision packet can carry.
 *
 * This is the whole of its influence on a recommendation. It arrives as
 * evidence, on one side or the other, and everything downstream is the
 * machinery that was already there: `strengthOf()` sees the contradiction,
 * `resolveAction()` refuses to let a committing action stand on contested
 * evidence. Synthesis never picks an action and has no way to.
 */
export function synthesisEvidence(s: Synthesis): DecisionEvidence {
  return {
    claim: s.finding,
    // Named so a reader can tell a cross-signal reading from a page one, and
    // so it counts as its own source when strength is computed. That is
    // correct: a finding drawn from two datasets neither page could reach is
    // a distinct line of evidence.
    source: `Cross-signal synthesis (${s.signals.map((x) => x.evidence.source).join(" + ")})`,
    // Derived from other readings rather than observed. Never "measured", even
    // when every input was measured, because the relationship was not.
    basis: "modelled",
    lane: worstLane(s.signals),
    asOf: s.signals.map((x) => x.observedAt).filter(Boolean).sort().slice(-1)[0] ?? null,
  };
}

/**
 * The block handed to the model, when a page has synthesis to write about.
 *
 * States the relation in the fixed vocabulary and forbids the causal reading
 * outright, because "coincides with" is one careless rewrite away from
 * "caused" and the guard that catches a reversed direction would not see it.
 */
export function synthesisBlock(items: readonly Synthesis[]): string {
  if (items.length === 0) return "";
  const lines = items.map(
    (s) =>
      `- [${s.relation.toUpperCase()}] ${s.finding}\n  What it means: ${s.implication}\n  Drawn from: ${s.signals.map((x) => `${x.evidence.source} (${x.evidence.basis})`).join("; ")}`
  );
  return `CROSS-SIGNAL FINDINGS (computed, fixed, do not change):
${lines.join("\n")}

These combine datasets that no single page reads together. You may explain what
a combination means for this reader and which of them matters most. You may not
restate one as a different relationship, drop a contradicting one, or claim that
either reading caused the other. This product records co-movement and never
establishes mechanism: write "coincides with" or "alongside", never "because",
"drove", "led to" or "resulted in".`;
}
