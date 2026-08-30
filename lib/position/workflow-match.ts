import { USE_CASES, type UseCase } from "@/lib/aie/use-cases";

// Does this sentence describe THIS workflow?
//
// WHAT THIS REPLACES. Two of the workflow label's own words appearing in a
// statement. That rule could not recognise the same activity said differently,
// and it could not tell a real description from a coincidence:
//
//   "uses machine learning to detect fraudulent card transactions"
//       missed Transaction Fraud Detection entirely, because "fraudulent" is
//       not "fraud" and "detect" is not "detection"
//
//   "a vendor-reported proof point rather than an independently audited
//    customer outcome"
//       matched Expense Report Audit, because "report" and "audit" are in it
//
// Both failures come from the same place: the label is three words, and three
// words are not a description of anything.
//
// WHAT IT USES INSTEAD, AND WHY IT IS NOT A PHRASE LIST. The catalogue already
// describes every one of its 75 workflows: a label, a one-line description, a
// subcategory and the inputs the work actually runs on. That is real semantic
// content, written by whoever curated the library, and it moves when the
// library moves. A hand-written list of English phrases would be a second,
// worse copy of it that goes stale silently.
//
// DISTINCTIVENESS IS COMPUTED, NOT DECLARED. "customer", "data" and "automation"
// appear across the catalogue and identify nothing; "fraudulent", "SKU" and
// "refactor" appear once or twice and identify almost uniquely. So every term
// carries its document frequency ACROSS THE CATALOGUE, and a match has to
// include at least one term that is rare in it. Nobody maintains that list and
// it cannot drift from the library, because it is derived from the library.

/** How rare a term has to be, across 75 workflows, to identify one. */
const DISTINCTIVE_MAX_DF = 6;

/** How short a stem may get before it stops being a word. */
const MIN_STEM = 4;

/**
 * Words that carry no workflow meaning wherever they appear.
 *
 * Deliberately tiny. Real disambiguation is done by document frequency, which
 * is measured; this list only removes the grammar that would otherwise inflate
 * every score equally. Anything that could conceivably distinguish two
 * workflows is left in for the frequency count to judge.
 */
const STOP = new Set([
  "with", "and", "the", "for", "from", "into", "over", "using", "used", "use",
  "their", "there", "that", "this", "these", "those", "than", "then", "when",
  "which", "while", "where", "what", "who", "will", "would", "could", "should",
  "have", "has", "had", "been", "being", "are", "was", "were", "its", "it",
  "company", "companies", "group", "business", "organisation", "organization",
  "across", "within", "through", "against", "about", "also", "more", "most",
  "new", "own", "per", "via", "each", "both", "other", "such", "same",
]);

/**
 * A word reduced to something two forms of it agree on.
 *
 * A SUFFIX STRIPPER, NOT A LINGUIST. "detection" and "detect", "forecasting"
 * and "forecast", "pricing" and "price" have to meet, and nothing more
 * ambitious than that is needed or wanted: an aggressive stemmer collapses
 * words that mean different things, which is the failure this module exists to
 * avoid. Where stripping would leave less than a word, the word is kept whole.
 */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const suffix of ["ations", "ation", "ings", "ing", "ions", "ion", "ments", "ment", "ers", "er", "ies", "ed", "es", "s"]) {
    if (w.length - suffix.length >= MIN_STEM && w.endsWith(suffix)) {
      w = w.slice(0, w.length - suffix.length);
      break;
    }
  }
  // "pricing" strips to "pric", "price" to "price". One trailing e, no more.
  if (w.length > MIN_STEM && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Every meaningful stem in a piece of text, deduplicated. */
export function stemsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    const s = stem(raw);
    if (s.length >= 3) out.add(s);
  }
  return out;
}

/** What a workflow is, in the catalogue's own words, weighted by where it sat. */
interface Profile {
  /** Stem to weight: the label says most, the inputs least. */
  terms: Map<string, number>;
  /** The stems of the label's head nouns: what the work IS, not what it is about. */
  heads: Set<string>;
  /**
   * The label's segments, each as a set of stems.
   *
   * Split rather than pooled because a slash in a catalogue label separates two
   * NAMES FOR ONE WORKFLOW, not two halves of one name. "Knowledge Assistant /
   * Internal Search" is named completely by either side, and requiring all four
   * words rejected "the bank is piloting a knowledge assistant".
   */
  labelSegments: Set<string>[];
  /** Stems from the description and inputs only: how the work is actually done. */
  mechanism: Set<string>;
}

const WEIGHT = { label: 3, description: 2, subcategory: 1, inputs: 1 } as const;

function buildProfile(uc: UseCase): Profile {
  const terms = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const s of stemsOf(text)) {
      terms.set(s, Math.max(terms.get(s) ?? 0, weight));
    }
  };
  add(uc.label, WEIGHT.label);
  if (uc.description) add(uc.description, WEIGHT.description);
  if (uc.subcategory) add(uc.subcategory, WEIGHT.subcategory);
  for (const input of uc.commonInputs ?? []) add(input, WEIGHT.inputs);

  // The head noun of each label segment, which is the activity the workflow
  // performs. "Transaction Fraud Detection" is detection; "Demand Forecasting"
  // is forecasting. A sentence that never refers to the activity is a sentence
  // about the subject area, not about the work.
  // Parentheticals are qualifiers, never the activity. "Live Agent Assist
  // (real-time)" is an assist; read naively its head noun comes out as "time",
  // and any sentence saying "in real time" then claimed to describe it. A
  // fraud-scoring sentence matched it on exactly that.
  const heads = new Set<string>();
  for (const segment of uc.label.replace(/\([^)]*\)/g, " ").split(/[/&]/)) {
    const words = segment
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w));
    if (words.length > 0) heads.add(stem(words[words.length - 1]));
  }

  // The mechanism words: what the work DOES, as opposed to what it is about.
  // A sentence can describe a workflow perfectly without using its label, and
  // the catalogue's own description is where that vocabulary lives.
  const mechanism = new Set<string>();
  for (const text of [uc.description ?? "", ...(uc.commonInputs ?? [])]) {
    for (const t of stemsOf(text)) mechanism.add(t);
  }
  for (const t of stemsOf(uc.label)) mechanism.delete(t);

  const labelSegments = uc.label
    .replace(/\([^)]*\)/g, " ")
    .split(/[/&]/)
    .map((seg) => stemsOf(seg))
    // Two stems minimum. A one-word segment is a word, not a name, and any
    // sentence containing it would "name the workflow outright": live Boots
    // matched Sales / Account Research on the word "sales" in a sentence about
    // annual sales, and live Tesco matched Financial Analysis & Reporting on
    // "reports" in a sentence about what Wikipedia reports.
    .filter((set) => set.size >= 2);

  return { terms, heads, mechanism, labelSegments };
}

const PROFILES: Map<string, Profile> = new Map(
  USE_CASES.map((uc) => [uc.id, buildProfile(uc)])
);

/**
 * How many workflows each stem appears in.
 *
 * This is the whole disambiguation mechanism and it costs one pass over the
 * catalogue at module load. A stem in forty workflows separates nothing; a stem
 * in one separates almost perfectly.
 */
const DOC_FREQUENCY: Map<string, number> = (() => {
  const df = new Map<string, number>();
  for (const p of PROFILES.values()) {
    for (const term of p.terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
})();

export function documentFrequency(term: string): number {
  return DOC_FREQUENCY.get(stem(term)) ?? 0;
}

export function isDistinctive(term: string): boolean {
  const df = documentFrequency(term);
  return df > 0 && df <= DISTINCTIVE_MAX_DF;
}

export interface Alignment {
  /** True where the text describes this workflow well enough to act on. */
  aligned: boolean;
  /** Weighted overlap. Ordering only, never shown: it is not a confidence. */
  score: number;
  /** The rare terms that carried it, which is what makes the match arguable. */
  distinctive: string[];
  /** Whether the text refers to the activity the workflow performs. */
  namesActivity: boolean;
}

/** Nothing below this is a description of the workflow, only a brush past it. */
const MIN_SCORE = 8;
/**
 * The bar when the text never names the activity and the match rests on the
 * mechanism words alone.
 *
 * Higher because those words include the workflow's OBJECTS as well as its
 * verbs, and a sentence can carry the objects while describing no work at all.
 * Measured: "the bank says card payment fraud is a material risk" collects
 * card, payment, fraud and risk for exactly 8, which is a sentence about a
 * topic and not about a system. Every genuine mechanism-only match in the
 * control set scores 13 or more.
 */
const MIN_SCORE_MECHANISM = 10;
/** Rare terms required. One is a coincidence away; two is a description. */
const MIN_DISTINCTIVE = 2;

/**
 * Whether a passage describes this workflow.
 *
 * THE THREE CONDITIONS, all required, and each one answers a failure that has
 * actually shipped:
 *
 *   names the activity   the text refers to what the work DOES, not only to
 *                        its subject area. "Discussed fraud risks in its
 *                        annual report" is about fraud and describes no
 *                        detection, so it cannot evidence a detector
 *   two rare terms       a single rare word is a coincidence away. "Fraud"
 *                        alone appears in a sentence about fraud losses,
 *                        fraud risk and fraud teams, none of which is a fraud
 *                        detection system
 *   weighted overlap     enough of the catalogue's own description of the
 *                        workflow is present that the sentence is plausibly
 *                        about it rather than glancing off it. Measured: at 6
 *                        an evidence-quality aside ("a vendor-reported proof
 *                        point rather than an independently audited outcome")
 *                        reached Expense Report Audit; every genuine match in
 *                        the control set scores 8 or more
 *
 * The score is for ordering competing workflows and is never rendered. There is
 * no defensible way to turn this into a percentage and showing one would invite
 * a trust the method cannot carry.
 */
export function alignment(text: string, uc: UseCase): Alignment {
  const profile = PROFILES.get(uc.id);
  if (!profile) return { aligned: false, score: 0, distinctive: [], namesActivity: false };

  const said = stemsOf(text);
  let score = 0;
  const distinctive: string[] = [];
  for (const [term, weight] of profile.terms) {
    if (!said.has(term)) continue;
    score += weight;
    if (isDistinctive(term)) distinctive.push(term);
  }

  // NAMING THE ACTIVITY, TWO WAYS. Either the text uses the label's own head
  // noun, or it describes the mechanism: two or more rare terms out of the
  // catalogue's description of how the work is done. "Runs models that score
  // payment transactions for fraud in real time" never says "detection" and is
  // unmistakably a fraud detector; "discussed fraud risks in its annual report"
  // says neither, and is about the subject rather than the work.
  const mechanismHits = distinctive.filter((t) => profile.mechanism.has(t));
  const namesHead = [...profile.heads].some((h) => said.has(h));
  const namesActivity = namesHead || mechanismHits.length >= 2;
  const floor = namesHead ? MIN_SCORE : MIN_SCORE_MECHANISM;

  // A text using every word of one of the label's names has NAMED the workflow,
  // and no score threshold should overrule that. Two-word labels like Demand
  // Forecasting cannot reach MIN_SCORE on the label alone, so without this
  // "runs demand forecasting models across its stores" fell short of a bar
  // built for labels with more words in them. One rare term is still required,
  // so a segment of common words cannot carry it alone.
  const namedOutright = profile.labelSegments.some((seg) =>
    [...seg].every((t) => said.has(t))
  );

  return {
    aligned:
      namesActivity &&
      (namedOutright
        ? distinctive.length >= 1
        : distinctive.length >= MIN_DISTINCTIVE && score >= floor),
    score,
    distinctive: distinctive.sort(),
    namesActivity,
  };
}

/**
 * The workflow a passage describes, where it describes one at all.
 *
 * Returns the best-aligned candidate, or null. Ties break on the workflow id so
 * the same passage always resolves the same way.
 */
export function bestAlignment(
  text: string,
  candidates: readonly UseCase[]
): { uc: UseCase; alignment: Alignment } | null {
  let best: { uc: UseCase; alignment: Alignment } | null = null;
  for (const uc of candidates) {
    const a = alignment(text, uc);
    if (!a.aligned) continue;
    if (
      !best ||
      a.score > best.alignment.score ||
      (a.score === best.alignment.score && uc.id < best.uc.id)
    ) {
      best = { uc, alignment: a };
    }
  }
  return best;
}
