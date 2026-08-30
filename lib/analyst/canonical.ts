// The canonical intelligence contract: what the model may not contradict.
//
// The existing guard in llm.ts answers one question well: did the model write
// a figure the data did not contain. That is necessary and it is not
// sufficient. Three failures pass a numeric check untouched:
//
//   1. the action reverses     computed "Clear open risks before widening"
//                              rewritten as "Widen scope now". No figure moved.
//   2. the direction reverses  computed "capability spread is narrowing"
//                              rewritten as "the gap is widening". No figure
//                              moved, and the reader is told the opposite of
//                              what the data says.
//   3. a small count is made   "3 vendors meet the threshold" when 3 was never
//                              supplied. numbersIn() drops every integer under
//                              eleven, so this has always passed.
//
// This module holds the three checks that close them. It is deliberately not
// an NLP engine. Every check is a vocabulary lookup over explicit word lists,
// and every check FAILS SAFE: an ambiguous reading is treated as a violation,
// the authored text is discarded, and the deterministic prose renders instead.
// A false rejection costs the page its analyst voice for one render. A false
// acceptance costs the reader the truth. Those are not the same price.
//
// Nothing here is allowed to reach for the network or the filesystem: it runs
// inside the same server render as the guard it extends.

// ------------------------------------------------------------ action intent

/**
 * What a recommended action asks the reader to DO, stripped of its wording.
 *
 * This is the immutable half of an action. The model may rewrite the sentence;
 * it may not move the sentence between these.
 *
 *   advance     commit further: accelerate, expand, roll out, scale
 *   restrain    commit less: pause, reduce exposure, hold, contain
 *   examine     look before committing: monitor, investigate, review
 *   select      choose from a set: shortlist, re-open a shortlist
 *   press       apply commercial pressure: renegotiate, re-price, tier
 *
 * `advance` and `restrain` are the two COMMITTED intents: each one tells a
 * reader to move budget or scope in a direction. The other three are
 * PROVISIONAL: they ask for work before the commitment is made. The distinction
 * is what makes "Monitor rewritten as Accelerate" catchable, which is a
 * strengthening rather than a reversal and is forbidden for the same reason.
 */
export type ActionIntent =
  | "advance"
  | "restrain"
  | "examine"
  | "select"
  | "press";

const COMMITTED: readonly ActionIntent[] = ["advance", "restrain"];

/**
 * The eight canonical actions, mapped to intent.
 *
 * These are `AnalystAction` from lib/analyst/insight.ts. They are not imported
 * from there because insight.ts is a 1,300-line module that pulls in the whole
 * dataset layer, and this file is imported by the guard, which must stay cheap
 * and side-effect free. The union is small, stable and asserted against the
 * real type in tests/analyst-canonical.test.ts, so a drift between the two
 * fails the suite rather than silently weakening the check.
 */
const TAXONOMY_INTENT: Readonly<Record<string, ActionIntent>> = {
  accelerate: "advance",
  expand: "advance",
  pause: "restrain",
  "reduce exposure": "restrain",
  monitor: "examine",
  investigate: "examine",
  shortlist: "select",
  renegotiate: "press",
};

/**
 * Words that carry each intent in free-text imperatives.
 *
 * Only used for classifying text. The canonical side declares its intent
 * outright wherever it can, because classifying our own prose would make the
 * safety of the check depend on the same fuzziness it is guarding against.
 */
const INTENT_WORDS: Readonly<Record<ActionIntent, readonly string[]>> = {
  advance: [
    "accelerate", "accelerating", "expand", "expanding", "widen", "widening",
    "scale", "scaling", "roll out", "rollout", "broaden", "broadening",
    "increase", "increasing", "grow", "growing", "commit", "committing",
    "adopt", "adopting", "deploy", "deploying", "extend", "extending",
    "double down", "speed up", "ramp up",
  ],
  restrain: [
    "pause", "pausing", "halt", "halting", "stop", "stopping", "freeze",
    "freezing", "hold back", "reduce", "reducing", "cut", "cutting",
    "shrink", "shrinking", "limit", "limiting", "contain", "containing",
    "restrict", "restricting", "defer", "deferring", "delay", "delaying",
    "wind down", "step back", "exit", "withdraw", "withdrawing",
    "reduce exposure", "tighten", "tightening",
  ],
  examine: [
    "monitor", "monitoring", "investigate", "investigating", "review",
    "reviewing", "assess", "assessing", "examine", "examining", "watch",
    "watching", "track", "tracking", "audit", "auditing", "evaluate",
    "evaluating", "check", "checking", "re-check", "recheck", "test",
    "testing", "verify", "verifying", "clear",
  ],
  select: [
    "shortlist", "shortlisting", "select", "selecting", "choose", "choosing",
    "pick", "picking", "re-open", "reopen", "re-opening", "reopening",
    "compare", "comparing",
  ],
  press: [
    "renegotiate", "renegotiating", "negotiate", "negotiating", "press",
    "pressing", "challenge", "challenging", "re-price", "reprice",
    "repricing", "tier", "tiering", "rebid", "re-bid",
  ],
};

function wordRe(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(s|d|ing)?([^a-z0-9]|$)`, "i");
}

/**
 * The intent a piece of action text carries, or null when nothing in it does.
 *
 * A canonical action name wins outright over vocabulary: "Pause" is Pause even
 * though "pause" is also in the restrain word list, and matching the taxonomy
 * first means a rename of a vocabulary word cannot move a taxonomy action.
 *
 * Where several intents match, the COMMITTED one wins. "Clear open risks
 * before widening" contains both an examine word and an advance word; reading
 * it as advance is the cautious reading, because if the model has written
 * something that could be read as a commitment, that is the reading a reader
 * might take from it.
 */
export function actionIntent(text: string): ActionIntent | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // An exact taxonomy action, or one used as the leading verb.
  for (const [name, intent] of Object.entries(TAXONOMY_INTENT)) {
    if (t === name || t.startsWith(`${name} `)) return intent;
  }

  const matched = new Set<ActionIntent>();
  for (const [intent, words] of Object.entries(INTENT_WORDS) as [
    ActionIntent,
    readonly string[],
  ][]) {
    for (const w of words) {
      if (wordRe(w).test(t)) {
        matched.add(intent);
        break;
      }
    }
  }
  if (matched.size === 0) return null;
  // The cautious reading: a committed intent, if one is present at all.
  for (const c of COMMITTED) if (matched.has(c)) return c;
  return [...matched][0];
}

/**
 * True when a rewritten action may not stand in for the canonical one.
 *
 * Two things are refused, and only two, so that ordinary rephrasing survives:
 *
 *   reversal      the canonical action commits one way and the rewrite commits
 *                 the other. Pause becoming Accelerate. Reduce exposure
 *                 becoming Expand.
 *   strengthening the canonical action is provisional and the rewrite commits.
 *                 Monitor becoming Accelerate. This is the deterministic layer
 *                 saying "look first" and the model saying "go", which is
 *                 exactly the recommendation-beyond-the-evidence failure.
 *
 * Softening is allowed, deliberately. A rewrite that turns Accelerate into
 * "Review before scaling" understates what the evidence supports, which is a
 * worse product and not a safety failure, and refusing it would discard sound
 * prose. Anything unclassifiable on the written side is allowed through for the
 * same reason: a neutral sentence carries no contradicting instruction.
 */
export function intentViolation(
  canonical: ActionIntent | null,
  written: string
): "reversal" | "strengthening" | null {
  if (!canonical) return null;
  const got = actionIntent(written);
  if (!got || got === canonical) return null;

  const canonicalCommitted = COMMITTED.includes(canonical);
  const writtenCommitted = COMMITTED.includes(got);

  if (canonicalCommitted && writtenCommitted) return "reversal";
  if (!canonicalCommitted && writtenCommitted) return "strengthening";
  return null;
}

// -------------------------------------------------------- semantic direction

/**
 * A directional statement the deterministic layer has already made.
 *
 * `family` names the axis, `pole` names which end of it. Two claims on the same
 * family with different poles contradict each other, and that is the entire
 * mechanism: no parsing, no sentiment, no attempt to work out what is true.
 */
export interface DirectionClaim {
  family: string;
  pole: string;
}

/**
 * The axes this product's prose actually moves along, and the words it moves
 * with. Each family has exactly two poles, because a claim is only useful here
 * if it has a definite opposite.
 *
 * The vocabulary is tight on purpose. A word that is directional only in some
 * readings ("closing", which also means shutting; "lost", which also means
 * mislaid) is left out, because every entry is a chance to reject sound prose.
 */
const FAMILIES: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  trend: {
    up: [
      "rising", "rise", "rises", "rose", "risen", "increasing", "increased",
      "increase", "climbing", "climbed", "higher", "growing", "grew", "grown",
      "accelerating", "accelerated", "upward", "improving", "improved",
    ],
    down: [
      "falling", "fall", "falls", "fell", "fallen", "declining", "declined",
      "decline", "dropping", "dropped", "lower", "shrinking", "shrank",
      "shrunk", "easing", "eased", "downward", "worsening", "worsened",
    ],
  },
  spread: {
    widening: ["widening", "widened", "widen", "widens", "wider", "diverging", "diverged"],
    narrowing: ["narrowing", "narrowed", "narrow", "narrows", "narrower", "converging", "converged"],
  },
  concentration: {
    concentrating: ["concentrating", "concentrated", "concentration", "consolidating", "consolidated"],
    fragmenting: ["fragmenting", "fragmented", "fragmentation", "dispersing", "dispersed", "diversifying"],
  },
  position: {
    gaining: ["gaining", "gained", "gains", "advancing", "advanced"],
    slipping: ["slipping", "slipped", "slips", "losing ground", "falling behind"],
  },
};

/**
 * "up 1.2" and "down 0.4", which is how the computed judgement states a
 * direction of travel. Handled apart from the word lists because bare "up" and
 * "down" are far too common in ordinary prose ("up to three vendors", "down
 * from last quarter") to be treated as directional on their own.
 */
const BARE_TREND =
  /(^|[^a-z0-9])(up|down)\s+(?=\d|on\b|from\b|against\b)/gi;

function polesPresent(text: string, family: string): Set<string> {
  const out = new Set<string>();
  const poles = FAMILIES[family];
  for (const [pole, words] of Object.entries(poles)) {
    for (const w of words) {
      if (wordRe(w).test(text)) {
        out.add(pole);
        break;
      }
    }
  }
  if (family === "trend") {
    for (const m of text.matchAll(BARE_TREND)) {
      out.add(m[2].toLowerCase() === "up" ? "up" : "down");
    }
  }
  return out;
}

/**
 * The directional claims a piece of canonical prose makes.
 *
 * A family contributes a claim only when the canonical text lands on exactly
 * ONE of its poles. Text saying "three vendors gaining, two slipping" names
 * both poles of `position` and therefore claims no direction at all, which is
 * correct: there is no single direction there for the model to reverse, and
 * asserting one would reject every honest rewrite of a mixed picture.
 *
 * This is why the claims are read off the deterministic prose rather than
 * declared by thirteen separate builders. The computed sentence IS the
 * canonical statement; anything it says plainly is what the written version
 * must not contradict.
 */
export function claimsFrom(canonical: string): DirectionClaim[] {
  const out: DirectionClaim[] = [];
  for (const family of Object.keys(FAMILIES)) {
    const present = polesPresent(canonical, family);
    if (present.size === 1) out.push({ family, pole: [...present][0] });
  }
  return out;
}

/**
 * The claims the written text reverses.
 *
 * A reversal is the written text landing on the opposite pole while saying
 * nothing at the claimed one. Text that names both poles is left alone: "prices
 * are falling even as the capability gap widens" contains a widening word
 * against a narrowing claim, and is a legitimate sentence about two different
 * things rather than a contradiction of either.
 */
export function reversedClaims(
  written: string,
  claims: readonly DirectionClaim[]
): DirectionClaim[] {
  const out: DirectionClaim[] = [];
  for (const claim of claims) {
    if (!FAMILIES[claim.family]) continue;
    const present = polesPresent(written, claim.family);
    if (present.size === 0) continue;
    if (present.has(claim.pole)) continue;
    out.push(claim);
  }
  return out;
}

// ------------------------------------------------------------- count claims

/**
 * Nouns this product counts, and therefore makes claims about.
 *
 * The guard drops every integer under eleven, on the reasoning that small
 * integers in this copy are list positions and turns of phrase. That is true of
 * "do these 3 things" and false of "3 vendors meet the threshold", and the
 * difference is entirely in the noun.
 *
 * So this is an explicit list rather than a rule. Everything on it is something
 * the datasets hold a real count of; everything absent from it is structural
 * and stays exempt. "things", "steps", "points", "inputs", "areas", "reasons"
 * are all deliberately not here, and two shipped tests depend on their absence.
 */
const COUNTED_NOUNS: readonly string[] = [
  "vendor", "provider", "supplier", "model", "workload", "market", "category",
  "categories", "risk", "record", "source", "dataset", "integrator", "partner",
  "lab", "cloud", "region", "jurisdiction", "obligation", "framework",
  "benchmark", "capability", "capabilities", "pillar", "domain", "deal",
  "contract", "buyer", "competitor", "incident", "finding", "quarter", "tier",
  "role", "sector", "company", "companies", "workflow", "customer", "seat",
  "licence", "license", "control", "clause", "term", "commitment",
];

const COUNT_RE = new RegExp(
  `(^|[^a-z0-9.])(\\d{1,2})\\s+(?:[a-z-]+\\s+){0,2}?(${COUNTED_NOUNS.join("|")})(s|es)?([^a-z0-9]|$)`,
  "gi"
);

/**
 * Small-integer counts of real things, as "3 vendors" rather than "3".
 *
 * Only integers of ten or under, because everything above that is already
 * checked by numbersIn(). The two do not overlap, so nothing is reported twice
 * and neither weakens the other.
 *
 * Up to two words are allowed between the number and the noun, so "3 tracked
 * vendors" and "5 frontier model providers" are caught. More than two and the
 * association stops being reliable enough to reject prose over.
 */
export function countClaims(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of text.matchAll(COUNT_RE)) {
    const n = Number(m[2]);
    if (!Number.isInteger(n) || n > 10) continue;
    out.set(String(n), `${n} ${m[3].toLowerCase()}${m[4] ? m[4].toLowerCase() : ""}`);
  }
  return out;
}

/**
 * Every integer the facts contain, including the small ones numbersIn drops.
 *
 * Whole numeric tokens only. Scanning for bare digit runs reads "13.7" as a 13
 * and a 7, and a facts sheet carrying a spread of 13.7 would then licence the
 * model to write "7 vendors clear the threshold" out of nothing. The decimal
 * has to be consumed as one token and then rejected for not being an integer.
 */
export function integersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isInteger(n)) out.add(String(n));
  }
  return out;
}

/**
 * Counted claims in the output whose number the facts never supplied.
 *
 * Grounding is membership: the integer has to appear SOMEWHERE in the facts.
 * That is looser than demanding the same number against the same noun, and
 * deliberately so. Facts saying "3 providers" licence a written "3 vendors",
 * because the model rephrasing our own noun is the behaviour we want and
 * rejecting it would make the analyst voice unusable. What it will not licence
 * is a count that was never in the data at all, which is the failure.
 */
export function unsupportedCounts(output: string, facts: string): string[] {
  const supplied = integersIn(facts);
  const out: string[] = [];
  for (const [n, phrase] of countClaims(output)) {
    if (!supplied.has(n)) out.push(phrase);
  }
  return out;
}

// ---------------------------------------------------- The temporal contract
//
// A state is not a trend, and the deterministic layer has enforced that on
// itself since the signal module was written: `signal()` strips a direction
// from a single observation at construction, and `stateWording()` hands back
// "is narrow" to a caller who asked for "narrowing".
//
// None of that reached the authored layer. The model was handed the finished
// prose and could add the verb the data does not carry, which is what it did:
// a single-observation adoption reading was published as "adoption demand
// keeps climbing", past every guard in the product, because no figure had
// moved, no vendor was named that should not be, and no direction had been
// reversed. Continuation is its own claim and needed its own check.
//
// WHAT THIS IS NOT. Not a parser and not a general trend detector. A short
// list of constructions that assert continuation or acceleration outright,
// checked against the temporal class the intelligence layer already computed.

/**
 * The strongest temporal claim the evidence licenses.
 *
 * Deliberately the same three words `temporalClass()` returns, so the licence
 * and the classifier cannot drift apart.
 */
export type TemporalLicence = "state" | "change" | "acceleration";

const RANK: Readonly<Record<TemporalLicence, number>> = {
  state: 0,
  change: 1,
  acceleration: 2,
};

/**
 * Constructions that assert a reading is CONTINUING to move.
 *
 * Licensed by `change` and above. A single observation cannot support any of
 * them: "keeps climbing" is a claim about a sequence, and there is no
 * sequence.
 *
 * Two shapes. The first is unambiguous continuation wording, which is a trend
 * claim in any context. The second binds a progressive verb to a copula
 * ("adoption IS rising") so that the claim is caught while an ordinary noun
 * phrase that happens to contain the word ("the rising tide of enterprise AI")
 * is left alone. Every entry is a chance to reject sound prose, so the list
 * stays short and each entry earns its place.
 */
const CONTINUATION: readonly RegExp[] = [
  /\bkeeps?\s+(?:on\s+)?(?:rising|climbing|falling|growing|declining|widening|narrowing|increasing|decreasing)\b/i,
  /\bcontinues?\s+(?:to\s+)?(?:rise|risen|rising|climb|climbing|fall|falling|grow|growing|decline|declining|widen|widening|narrow|narrowing|increase|increasing|decrease|decreasing)\b/i,
  /\bcontinuing\s+to\s+\w+/i,
  /\bstill\s+(?:rising|climbing|falling|growing|declining|widening|narrowing|increasing|decreasing)\b/i,
  /\bfurther\s+(?:widening|narrowing|rising|climbing|falling|growing|declining|increasing|decreasing)\b/i,
  /\bincreasingly\b/i,
  /\b(?:gaining|losing|building|gathering)\s+momentum\b/i,
  /\bmomentum\s+is\s+(?:building|growing|fading|slowing)\b/i,
  /\breversing\b|\brebounding\b|\brebound(?:ed)?\b/i,
  /\btrending\s+(?:up|down|upward|downward|higher|lower)\b/i,
  /\bon\s+an?\s+(?:upward|downward)\s+(?:trajectory|path|trend)\b/i,
  /\bhas\s+been\s+(?:rising|climbing|falling|growing|declining|widening|narrowing)\b/i,
  /\b(?:is|are|was|were)\s+(?:rising|climbing|falling|growing|declining|widening|narrowing)\b/i,
  /\b(?:has|have)\s+(?:risen|climbed|fallen|grown|declined|widened|narrowed|converged|diverged|tightened|loosened)\b/i,
  // Completed change stated as a bare verb. "Capability has converged" and
  // "the field converged" are the same claim, and the second slipped past a
  // list that only knew the auxiliary form. Caught because a spread measured
  // once cannot have converged: it is simply narrow, which is what
  // stateWording() would have said.
  /\b(?:converged|diverged|tightened|loosened|widened|narrowed)\b/i,
];

/**
 * Constructions that assert the RATE of movement is itself changing.
 *
 * Licensed by `acceleration` only, which today nothing in this product
 * reaches: no dataset carries three readings. That is the honest position and
 * the check is written for the day one does, rather than left until then.
 */
const ACCELERATION: readonly RegExp[] = [
  /\baccelerat(?:ing|ion|es|ed)\b/i,
  /\bdecelerat(?:ing|ion|es|ed)\b/i,
  /\bgathering\s+(?:pace|speed)\b/i,
  /\bpicking\s+up\s+(?:pace|speed)\b/i,
  /\bat\s+an?\s+(?:increasing|accelerating|quickening|growing)\s+(?:rate|pace)\b/i,
  /\bfaster\s+and\s+faster\b/i,
  /\brate\s+of\s+(?:increase|decline|growth|change)\s+(?:is\s+)?(?:growing|rising|increasing|climbing)\b/i,
];

/**
 * Temporal claims in the output that the licence does not support.
 *
 * Returns the offending phrases, so the retry can name them. An empty array
 * means every temporal claim made is one the evidence carries.
 */
export function temporalViolations(
  output: string,
  licence: TemporalLicence
): string[] {
  const bad: string[] = [];
  const rank = RANK[licence];
  if (rank < RANK.change) {
    for (const re of CONTINUATION) {
      const m = output.match(re);
      if (m) bad.push(m[0].trim().toLowerCase());
    }
  }
  if (rank < RANK.acceleration) {
    for (const re of ACCELERATION) {
      const m = output.match(re);
      if (m) bad.push(m[0].trim().toLowerCase());
    }
  }
  return [...new Set(bad)];
}

/**
 * The licence the canonical text has already taken for itself.
 *
 * The same move `claimsFrom()` makes for direction: read what the
 * deterministic layer said, and hold the written version to it. Used where a
 * caller has no structured signals to derive a licence from, which is most of
 * the authored surface. A page whose own computed prose describes a change may
 * have that change described back; a page whose prose describes a state may
 * not have a trend added to it.
 */
export function temporalFromText(canonical: string): TemporalLicence {
  if (ACCELERATION.some((re) => re.test(canonical))) return "acceleration";
  if (CONTINUATION.some((re) => re.test(canonical))) return "change";
  return "state";
}

/** The strongest licence in a set, which is the one that governs. */
export function strongestTemporal(
  classes: readonly TemporalLicence[]
): TemporalLicence {
  let best: TemporalLicence = "state";
  for (const c of classes) if (RANK[c] > RANK[best]) best = c;
  return best;
}

// --------------------------------------------------- The freshness contract
//
// The deterministic layer decides what may answer "why now". `speaksToNow()`
// admits evidence that may inform the decision; `canCreateUrgency()` admits
// only evidence current enough to be the reason to move this week. A finding
// resting on a benchmark past its refresh window is carried as evidence and
// kept out of the computed whyNow.
//
// The model was then handed that finding in the same undifferentiated block as
// everything else and asked to write a whyNow "drawn only from the evidence
// above". It did exactly that, and put the aging relationship back:
//
//   computed  29 of the 330 priced and benchmarked models reach 80 per cent of
//             the top score, and the cheapest of them costs 25 times less...
//   authored  Capability across frontier providers reads narrow on the
//             capability matrix alongside a 25x published input-price
//             separation between the top model and a qualifying alternative.
//
// The second sentence is the suppressed cross-dataset finding, restored by the
// only layer that was not told it had been suppressed.
//
// TWO MECHANISMS, BOTH CHECKABLE. The prompt now labels every evidence item
// with the role it may play, and this checks the answer rather than trusting
// the label was read. Neither is a request to the model.

/**
 * Content words distinctive to evidence that may NOT justify acting now.
 *
 * Built by subtraction: every substantial word in the non-urgency-capable
 * material, minus every word the permitted material also uses. What is left is
 * vocabulary that could only have come from the evidence the deterministic
 * layer refused to build a whyNow on, which makes its appearance in a whyNow
 * mechanically detectable without any judgement about meaning.
 *
 * Short words are dropped because they carry the grammar rather than the
 * claim, and because a five-character floor removes the need for a stopword
 * list that would need maintaining.
 */
/**
 * Generic prose that carries the grammar rather than the claim.
 *
 * Without this the subtraction below returns connectives: "across", "between",
 * "while", "different". They appear in the barred finding, they happen not to
 * appear in the permitted evidence, and they are in every third sentence an
 * analyst writes. Restricting them would reject sound prose and protect
 * nothing, which is the failure mode this whole check has to avoid: a false
 * rejection costs the page its analyst voice.
 */
const GENERIC = new Set([
  "across", "between", "while", "different", "taken", "point", "these",
  "those", "their", "there", "which", "where", "would", "could", "should",
  "about", "after", "before", "other", "another", "every", "than", "over",
  "under", "still", "being", "against", "within", "through", "because",
  "however", "rather", "already", "further", "though", "since", "given",
  "means", "meaning", "reads", "shows", "showing", "same", "both", "carry",
  "carries", "carrying", "holds", "holding", "stands", "standing",
]);

/**
 * Content words distinctive to evidence that may NOT justify acting now.
 *
 * Built by subtraction: every substantial word in the non-urgency-capable
 * material, minus every word the permitted material also uses, minus the
 * connectives above. What is left is vocabulary that could only have come from
 * the evidence the deterministic layer refused to build a whyNow on, which
 * makes its appearance in a whyNow mechanically detectable without any
 * judgement about meaning.
 *
 * MATCHED ON A FOUR-CHARACTER STEM, not on the whole word. "price", "priced"
 * and "pricing" are one concept and appear as all three across a fact sheet,
 * so exact matching restricted "price" on the Price / Performance page while
 * the permitted evidence said "priced": a legitimate rewrite mentioning the
 * price gap would have been thrown away. The stem is crude and it is the right
 * kind of crude here, because both sides are stemmed the same way and the cost
 * of a collision is one word left unrestricted rather than a wrong sentence.
 */
const STEM_LEN = 4;
const stem = (w: string) => w.slice(0, STEM_LEN);

export function restrictedVocabulary(
  /** Findings the deterministic layer barred from creating urgency. */
  barred: readonly string[],
  /** Everything that may legitimately ground a why now. */
  permitted: readonly string[]
): string[] {
  const words = (xs: readonly string[]) =>
    xs
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !GENERIC.has(w));
  const allowed = new Set(words(permitted).map(stem));
  return [...new Set(words(barred).filter((w) => !allowed.has(stem(w))))].sort();
}

/**
 * Assertions that something must happen NOW.
 *
 * Checked only where nothing in the packet is current enough to support one.
 * A statement of fact ("29 models clear the bar") is not on this list and
 * never trips it; a call to move this week is.
 */
const IMMEDIACY: readonly RegExp[] = [
  /\bact\s+now\b/i,
  /\bright\s+now\b/i,
  /\bimmediate(?:ly)?\b/i,
  /\bwithout\s+delay\b/i,
  /\bthis\s+week\b/i,
  /\burgent(?:ly|cy)?\b/i,
  /\bbefore\s+it\s+is\s+too\s+late\b/i,
  /\bno\s+time\s+to\s+(?:lose|waste)\b/i,
  /\bcan(?:not|'t)\s+wait\b/i,
  /\bmoving\s+fast\b/i,
];

/**
 * What the authored why now took from evidence that may not ground one.
 *
 * Two failures, reported together:
 *
 *   restricted vocabulary  the sentence is built out of the barred finding
 *   immediacy              it tells the reader to move now when nothing in the
 *                          packet is current enough to say so
 *
 * The first is the one that catches the shipped defect. The second catches the
 * blunter version, where the model asserts urgency without borrowing the
 * wording it came from.
 */
export function urgencyViolations(
  whyNow: string,
  restricted: readonly string[],
  /** True where at least one reading in the packet may establish "now". */
  urgencyAllowed: boolean
): string[] {
  const stems = new Set(
    whyNow
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(stem)
  );
  const bad = restricted.filter((w) => stems.has(stem(w)));
  if (!urgencyAllowed) {
    for (const re of IMMEDIACY) {
      const m = whyNow.match(re);
      if (m) bad.push(m[0].trim().toLowerCase());
    }
  }
  return [...new Set(bad)];
}

// ------------------------------------------------------- consultancy filler
//
// Phrases that signal an analyst has stopped analysing.
//
// EVERY ONE OF THESE IS A SENTENCE THAT COULD APPEAR ON ANY PAGE, in any
// market, in any year. "Organisations should monitor developments closely" is
// true of everything and therefore says nothing, and a reading that reaches for
// it has run out of argument and is filling the paragraph. That is not a
// truth failure and the numeric guards will never catch it: the sentence is
// perfectly accurate, which is the problem.
//
// Kept deliberately short and matched as phrases. "Data" and "suggests" are
// ordinary words that belong in careful writing; "the data suggests" is the
// hedge a writer uses when they do not want to own the conclusion, and owning
// the conclusion is the job.
const FILLER: RegExp[] = [
  /\bthe data (?:indicates?|suggests?|shows that|reveals?)\b/i,
  /\bit (?:is|remains) important to note\b/i,
  /\bit is worth noting\b/i,
  /\borganisations should (?:monitor|consider|be aware)\b/i,
  /\borganizations should (?:monitor|consider|be aware)\b/i,
  /\brapidly (?:evolving|changing|shifting) (?:ai )?landscape\b/i,
  /\bin today's fast[- ]moving\b/i,
  /\bcontinues? to evolve\b/i,
  /\bplays? a (?:key|crucial|vital|critical) role\b/i,
  /\bnavigate the complexit(?:y|ies)\b/i,
  /\bmonitor developments closely\b/i,
];

/**
 * The filler phrases an authored reading used.
 *
 * Returned rather than counted, so the retry can quote the exact phrase back:
 * a model told "your answer contained filler" rewrites at random, and one told
 * which five words to drop rewrites the sentence.
 */
export function consultancyFiller(text: string): string[] {
  const out: string[] = [];
  for (const re of FILLER) {
    const m = text.match(re);
    if (m) out.push(m[0].toLowerCase());
  }
  return [...new Set(out)];
}
