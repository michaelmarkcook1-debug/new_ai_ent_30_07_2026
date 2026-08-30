import type { EvidenceType } from "@/lib/research/facts";
import type { ReconciledMetric } from "@/lib/research/ingest";
import type { AiClaim } from "@/lib/research/company";

// What the reconciled research says about THIS company, in terms an
// opportunity can be selected on.
//
// THE GAP THIS FILLS. The product could say two things about a workflow: the
// company's sources mentioned it, or the company's sector runs it. The first is
// rare and the second is true of every company in that sector, so almost the
// whole list was "here is what a retailer might do", which a reader learns
// nothing from. There was no third thing: the sources say something about this
// company that makes a workflow it never mentions materially relevant.
//
// THE ONE RULE THE WHOLE MODULE TURNS ON. A signal may only ever come from
// evidence about this company. Nothing here reads the sector tag, and that is
// load-bearing rather than an omission: a rationale built from the sector is a
// rationale that survives swapping this company for any of its competitors,
// which is the definition of not being about this company. Because the sector
// cannot reach a signal, every signal carries at least one quote from this
// company's own retrieved sources, and so does every recommendation built on
// one. tests/company-signals.test.ts holds that boundary.
//
// WHAT IT REFUSES. An unsettled figure is not evidence. A reconciled metric the
// product could not resolve, whether CONFLICTING or INSUFFICIENT, cannot raise
// a signal: three revenue figures spanning threefold say nothing about scale
// except that nobody knows it. A stated intention is not practice. A sentence
// about the industry is not a sentence about the company. Each of those leaves
// the dimension UNKNOWN and says which one happened, so the reader can see the
// product looked rather than assuming it did not.

/** The dimensions worth deriving, being the ones that change which workflow applies. */
export type SignalDimension =
  | "cost_pressure"
  | "margin_pressure"
  | "customer_service_intensity"
  | "labour_intensity"
  | "digital_maturity"
  | "ai_adoption_maturity"
  | "data_intensity"
  | "legacy_dependency"
  | "regulatory_exposure"
  | "cyber_trust_exposure"
  | "supply_chain_complexity"
  | "customer_experience_pressure"
  | "growth_pressure"
  | "process_standardisation";

export type SignalState = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

/**
 * What kind of evidence sits under a signal.
 *
 * There is deliberately no "absent". A dimension nothing touched produces no
 * signal at all rather than an empty one, so the list a reader sees is only
 * ever things the sources actually spoke to. `unresolved` is the informative
 * middle: something was retrieved, and it was refused for a stated reason.
 */
export type SignalEvidenceState =
  /** A reconciled figure the product settled. */
  | "company_reported"
  /** Statements from this company's own retrieved sources. */
  | "company_stated"
  /** Candidates existed and none survived. The dimension stays UNKNOWN. */
  | "unresolved";

/** One piece of evidence under a signal, quotable and openable. */
export interface SignalBasis {
  /** The company's own words, or the settled figure. Never paraphrased. */
  quote: string;
  /** Index into the position's sources, so it opens the page it came from. */
  sourceIndex: number;
  kind: "statement" | "reconciled_fact";
  /** The source's own authority, where the retrieval established one. */
  evidenceType: EvidenceType | null;
}

export interface CompanySignal {
  dimension: SignalDimension;
  state: SignalState;
  /** Every piece of evidence, so the state can be interrogated. */
  basis: SignalBasis[];
  /** Why the state is what it is, in the reader's language. */
  reason: string;
  evidenceState: SignalEvidenceState;
}

export const DIMENSION_LABEL: Readonly<Record<SignalDimension, string>> = {
  cost_pressure: "cost pressure",
  margin_pressure: "margin pressure",
  customer_service_intensity: "customer-service intensity",
  labour_intensity: "labour intensity",
  digital_maturity: "digital maturity",
  ai_adoption_maturity: "AI adoption maturity",
  data_intensity: "data intensity",
  legacy_dependency: "legacy dependency",
  regulatory_exposure: "regulatory exposure",
  cyber_trust_exposure: "cyber and trust exposure",
  supply_chain_complexity: "supply-chain complexity",
  customer_experience_pressure: "customer-experience pressure",
  growth_pressure: "growth pressure",
  process_standardisation: "process standardisation",
};

// ------------------------------------------------------- reading a statement
//
// PART 5's FIVE STATES, AND WHY ONLY TWO OF THEM COUNT. A sentence about this
// company can be describing something running, something limited but running,
// something intended, something explicitly not happening, or something about
// the industry rather than the company. Only the first two are current
// practice. The other three were all being counted as evidence by a matcher
// that saw nothing but shared words, which is how "has no fraud detection
// capability" became evidence of fraud detection.

export type EvidenceStatus =
  /** Running now. */
  | "deployed"
  /** Running now, limited in scope. A pilot is practice, not intention. */
  | "pilot"
  /** Stated intention. Never practice. */
  | "planned"
  /** Explicitly not happening. Never evidence of anything. */
  | "negated"
  /** About the industry, not about this company. */
  | "sector_example";

/**
 * Wording that means the company is NOT doing this.
 *
 * Kept identical to the list `opportunities.ts` has carried since the matcher
 * was hardened, so a statement cannot be read one way when classifying a
 * workflow and another way when deriving a signal.
 */
const NEGATED =
  /\b(?:no|not|never|without|lacks?|lacking|absent|does not|do not|did not|has not|have not|hasn't|haven't|doesn't|don't|declined to|failed to|yet to|no longer|ceased|discontinued)\b/i;

/**
 * Wording that states an intention rather than a practice.
 *
 * "Piloting" is deliberately absent: a pilot is a real deployment, limited in
 * scope rather than hypothetical. So are bare modals, which appear constantly
 * in accurate descriptions of what a live system does.
 */
const PROSPECTIVE =
  /\b(?:plans? to|planning to|intends? to|intending to|aims? to|aiming to|expects? to|expected to|hopes? to|seeking to|set to|is considering|are considering|considering whether|exploring|evaluating|proposed|proposal|roadmap|announced plans|in talks to|has yet to|have yet to)\b/i;

/**
 * Wording that describes work as AVAILABLE to automate rather than automated.
 *
 * Found on live Barclays research: "a large back-office population exposed to
 * automation" was classifying Back-Office Operations Automation as EVIDENCED,
 * telling the reader the bank already runs it. The sentence says the opposite
 * of that. It is the same family as an intention, so it lands in the same
 * place, and it is scoped hard to the automation sense: "exposed to" carries
 * an entirely legitimate present-tense meaning elsewhere, and a company
 * "exposed to FCA regulation" is describing something true of it right now.
 */
const EXPOSURE =
  /\b(?:exposed to|exposure to|vulnerable to|candidates? for|suitable for|ripe for|potential for|opportunit(?:y|ies) for|amenable to)\s+(?:generative\s+)?(?:automation|ai\b|artificial intelligence|machine learning)/i;

const PILOT =
  /\b(?:pilot|piloting|piloted|trialling|trialing|trialled|proof of concept|proof-of-concept|limited rollout|early access|beta)\b/i;

/**
 * Wording whose subject is the industry rather than this company.
 *
 * NARROW ON PURPOSE, AND THE FIRST CUT WAS NOT. Matching the bare plural
 * ("retailers", "banks") rejected "one of the largest pharmacy-led health and
 * beauty retailers", which is a sentence about this company that happens to
 * name its category. So the plural has to be doing something: a subject with a
 * verb, a quantifier in front of it, or an explicit reference to the sector.
 */
const SECTOR_SUBJECT = [
  /\b(?:retailers|banks|insurers|manufacturers|hospitals|utilities|operators|competitors|peers|rivals|providers)\s+(?:are|were|have|has|typically|often|increasingly|generally|commonly|tend|use|using|deploy|face)\b/i,
  /\b(?:the|its|their)\s+(?:industry|sector)\b|\bindustry-wide\b|\bsector-wide\b|\bacross the (?:industry|sector)\b/i,
  /\b(?:many|most|other|several|some)\s+(?:retailers|banks|companies|firms|organisations|organizations|businesses|insurers|manufacturers|providers)\b/i,
];

/**
 * Where one clause of a sentence stops and the next begins.
 *
 * THE DEFECT THIS EXISTS FOR, found on live Barclays research on 30 August
 * 2026. The classifier tested the whole sentence for negation, and this came
 * back NEGATED:
 *
 *   "More than 250 AI tools and models are already in use across the group, so
 *    the buying question here is consolidation and governance of an existing
 *    estate, not first adoption."
 *
 * The "not" negates "first adoption" in a trailing contrast. The clause the AI
 * vocabulary actually matched says the opposite: 250 tools already in use. So
 * a bank running one of the larger AI estates in UK banking was recorded as
 * having no AI in production, which then marked down every serious workflow on
 * its list through the feasibility rule. One misplaced negation, and the
 * recommendation inverts.
 *
 * Splitting on contrast and consequence markers is not parsing and does not
 * pretend to be. It is enough to stop a negation in one clause being read as a
 * negation of another, which is the failure that was actually occurring.
 */
const CLAUSE_SPLIT =
  /;|\s+(?:so|but|whereas|although|though|while|rather than)\s+|,\s*(?:not|but|so|whereas|although|though|while|rather than)\s+/i;

/** The clauses of a statement, in order. Never empty. */
export function clausesOf(text: string): string[] {
  const parts = text
    .split(CLAUSE_SPLIT)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return parts.length > 0 ? parts : [text];
}

/**
 * The clause a match landed in, which is the only one whose negation counts.
 *
 * Falls back to the whole statement when nothing matches a single clause, so a
 * match spanning a clause boundary is judged on everything rather than lost.
 */
export function relevantClause(
  text: string,
  matches: (clause: string) => boolean
): string {
  return clausesOf(text).find(matches) ?? text;
}

/**
 * What a statement is actually saying about this company.
 *
 * Order matters and is argued rather than incidental. A sentence about the
 * industry is not about this company whatever tense it is in, so that is
 * checked first. Negation inverts everything after it, so it comes next.
 * Intention outranks the pilot test, because "plans to pilot" is a plan.
 *
 * Callers pass the CLAUSE their match landed in rather than the whole
 * statement, via `relevantClause()`. See CLAUSE_SPLIT for why.
 */
export function classifyStatement(text: string): EvidenceStatus {
  const s = text.toLowerCase();
  if (SECTOR_SUBJECT.some((re) => re.test(s))) return "sector_example";
  if (NEGATED.test(s)) return "negated";
  if (PROSPECTIVE.test(s) || EXPOSURE.test(s)) return "planned";
  if (PILOT.test(s)) return "pilot";
  return "deployed";
}

/** Only these two are current practice, and only these two may evidence anything. */
export function isCurrentPractice(status: EvidenceStatus): boolean {
  return status === "deployed" || status === "pilot";
}

// ------------------------------------------------------------- the vocabulary
//
// PHRASES, NOT WORDS. A single common term matches everywhere: "data" appears
// in any sentence about anything. Every pattern below is a phrase a company
// only writes when the thing is actually true of it, which trades recall for
// precision deliberately. A miss leaves an area SECTOR, which understates what
// the company does; a false match puts a claim about the reader's own business
// on their screen.

const VOCABULARY: Readonly<Record<SignalDimension, RegExp[]>> = {
  // A PRESSURE DIMENSION NEEDS THE PRESSURE, NOT THE NOUN. Found on live Tesco
  // research on 30 August 2026: "the profile withholds EPS, net income and net
  // profit margin behind placeholders" was raising MARGIN PRESSURE, because a
  // pattern matching a bare "profit margin" cannot tell a company whose margins
  // are under strain from a sentence about a data source withholding a figure.
  // The four dimensions below name conditions rather than things, so each one
  // requires a word that carries the condition.
  cost_pressure: [
    /\bcost (?:reduction|savings?|cutting|base|inflation|pressure|efficienc\w*)\b/i,
    /\bcost-(?:cutting|saving|reduction)\b/i,
    /\b(?:efficiency|restructuring|transformation|savings) programme\b/i,
    /\boverhead (?:reduction|costs?)\b|\bstore closures?\b|\bheadcount reduction\b/i,
  ],
  margin_pressure: [
    /\bmargins? (?:pressure|fell|declined|narrowed|compressed|under pressure)\b/i,
    /\b(?:squeezed|shrinking|falling|declining|eroding|thinner) margins?\b/i,
    /\bmargin (?:erosion|compression|decline|squeeze)\b/i,
    /\bprofitability (?:pressure|declined|fell)\b|\bdiscounting\b|\bprice competition\b/i,
  ],
  customer_service_intensity: [
    /\b(?:contact|call) cent(?:re|er)s?\b/i,
    /\bcustomer (?:service|support|enquir\w+|contact)\b/i,
    /\b(?:complaints? handling|service desk|help ?desk)\b/i,
    /\b(?:customer|service) advisors?\b|\bfront-?line colleagues\b/i,
  ],
  labour_intensity: [
    /\b(?:labour|labor) (?:costs?|shortages?|intensity)\b/i,
    /\b(?:staff|colleague|workforce) (?:shortages?|turnover|costs?)\b/i,
    /\b(?:recruitment|hiring) (?:drive|challenges?|difficult\w*)\b/i,
    /\bwage (?:bill|inflation|costs?)\b|\bstore colleagues\b/i,
  ],
  digital_maturity: [
    /\b(?:cloud|digital) (?:migration|transformation|platform|programme)\b/i,
    /\b(?:e-?commerce|online) (?:platform|channel|business|sales)\b/i,
    /\bmobile app\b|\bdigital channels?\b|\bAPI platform\b/i,
    /\bmoved to (?:the )?cloud\b|\b(?:AWS|Azure|Google Cloud)\b/i,
  ],
  ai_adoption_maturity: [
    /\b(?:artificial intelligence|machine learning|generative ai|gen ?ai)\b/i,
    /\bai[- ](?:powered|driven|assistants?|tools?|models?|platforms?|programmes?|capabilit\w+)\b/i,
    /\b(?:chatbot|virtual assistant|large language model|llm)s?\b/i,
    /\b(?:predictive|algorithmic) (?:model|analytics|pricing|maintenance)\b/i,
  ],
  data_intensity: [
    /\bdata (?:platform|warehouse|lake|estate|strategy|science)\b/i,
    /\b(?:customer|loyalty|transaction) data\b/i,
    /\b(?:advanced )?analytics (?:team|platform|capabilit\w+)\b/i,
    /\bloyalty (?:scheme|programme|card)\b|\bpersonalisation\b|\bpersonalization\b/i,
  ],
  legacy_dependency: [
    /\blegacy (?:system|platform|technolog\w+|estate|infrastructure)s?\b/i,
    /\bmainframe\b|\btechnical debt\b|\bageing (?:system|infrastructure)s?\b/i,
    /\bon-?premise\b|\bend[- ]of[- ]life (?:system|software)\b/i,
    /\bcore banking (?:system|platform)\b|\bERP (?:migration|replacement)\b/i,
  ],
  regulatory_exposure: [
    /\bregulated by\b|\bregulator(?:s|y body)?\b|\bsupervis(?:ed|ory) (?:by|authority)\b/i,
    /\b(?:FCA|PRA|SEC|Ofgem|Ofcom|Ofwat|CQC|MHRA|FDA|EBA|ESMA|BaFin)\b/,
    /\b(?:compliance|regulatory) (?:programme|obligations?|requirements?|framework)\b/i,
    /\b(?:GDPR|anti-money laundering|AML|know your customer|KYC|prudential|licence conditions)\b/i,
  ],
  cyber_trust_exposure: [
    /\b(?:cyber|ransomware|malware) (?:attack|incident|breach|threat)s?\b/i,
    /\bdata breach\b|\bsecurity incident\b|\bcyber-?security\b/i,
    /\b(?:fraud|financial crime) (?:losses|detection|prevention|team)\b/i,
    /\binformation security\b|\bpenetration test\b/i,
  ],
  supply_chain_complexity: [
    /\bsupply chains?\b|\bsuppliers?\b/i,
    /\b(?:distribution|fulfilment|fulfillment) cent(?:re|er)s?\b/i,
    /\b(?:logistics|sourcing) (?:network|operations?|partners?)\b/i,
    /\b(?:inventory|stock) (?:management|availability|levels)\b|\bwarehouses?\b/i,
  ],
  customer_experience_pressure: [
    /\bcustomer (?:satisfaction|experience) (?:scores?|fell|declined|programme|targets?)\b/i,
    /\b(?:falling|declining|rising|poor) (?:net promoter|NPS|customer satisfaction)\b/i,
    /\b(?:service levels?|waiting times?|delivery times?) (?:fell|slipped|missed|target|improv\w+)\b/i,
    /\bcustomer complaints\b|\bcomplaint volumes?\b/i,
  ],
  growth_pressure: [
    /\b(?:revenue|sales|market share) growth (?:of|target|strategy|slowed|stalled)\b/i,
    /\b(?:expansion|expanding) into\b|\bnew (?:stores?|markets?|territories)\b/i,
    /\bgrowth (?:strategy|target|plan|ambition)\b/i,
    // Not the bare word. Live Tesco, 30 August 2026: "ethical, safe and
    // compliant development, acquisition and use of AI" raised GROWTH PRESSURE
    // and argued for a pricing workflow off it. That "acquisition" is
    // procurement, not M&A, and "entering the" was matching anything at all.
    /\bmergers? and acquisitions?\b|\bacquisitions? (?:of|strategy|programme|spree)\b|\bacquired (?:a|the|its)\b/i,
    /\bentering (?:the )?(?:new|adjacent|overseas|international)? ?markets?\b/i,
  ],
  process_standardisation: [
    /\bstandardis(?:ed|ing|ation)\b|\bstandardiz(?:ed|ing|ation)\b/i,
    /\bshared services?\b|\bcentralis(?:ed|ing|ation)\b|\bcentraliz(?:ed|ing|ation)\b/i,
    /\b(?:process|robotic process) automation\b|\bRPA\b/,
    /\btarget operating model\b|\bback-?office (?:processing|operations?)\b/i,
  ],
};

/** Every dimension the module can ever produce, for the completeness check. */
export function allDimensions(): SignalDimension[] {
  return Object.keys(VOCABULARY) as SignalDimension[];
}

// ------------------------------------------------------------ scale from facts
//
// The one place a reconciled figure raises a signal on its own.
//
// WHY ONLY HEADCOUNT. A settled employee count is a fact about the size of the
// workforce, and the size of the workforce is what decides whether work that
// touches a workforce is worth doing. A revenue figure supports no comparable
// statement: it says how big the company is, not what its cost structure or its
// processes look like, and reading anything about pressure out of one number
// would be exactly the invention this layer exists to prevent.
//
// Only the large end is used. Below the threshold nothing is claimed, because a
// small headcount is not evidence of low labour intensity: a five-hundred
// person consultancy is among the most labour-intensive businesses there is.

/**
 * The headcount above which workforce-touching work is material at scale.
 *
 * A coarse threshold on a settled figure rather than a score, and stated on
 * screen with the figure beside it so a reader can disagree with it directly.
 */
export const LARGE_WORKFORCE = 25_000;

const EMPLOYEE_METRIC = /^(?:employees?|headcount|staff|workforce|colleagues|employee_count)$/;

// ------------------------------------------------------------------ derivation

/** Everything the derivation is allowed to read. No sector, by construction. */
export interface CompanyEvidence {
  /** Source URLs by index, so a quote opens the page it came from. */
  sources: { url: string; evidenceType: EvidenceType }[];
  /**
   * Statements with the source each cites, and for AI findings what the
   * research stage classified the sentence as claiming. The claim is carried,
   * never trusted: `lib/position/opportunities.ts` re-derives subject and
   * status from the sentence and takes whichever reading is stricter.
   */
  statements: {
    text: string;
    sourceIndex: number;
    /**
     * True where the research classified this as a statement about the
     * company's AI, rather than about its business.
     *
     * A business finding describes the company; an AI finding describes its AI.
     * Pooling them let a sentence about revenue estimates evidence an AI
     * workflow. Only an AI finding may evidence one.
     */
    ai?: boolean;
    claim?: AiClaim;
  }[];
  financials: ReconciledMetric[];
}

/**
 * Why a candidate was refused.
 *
 * `unsettled` is not one of Part 5's statement states and does not pretend to
 * be: it is what happens to a FIGURE the reconciliation could not resolve, and
 * it is tracked here so an unresolved number leaves a visible "nothing is
 * claimed" rather than silently vanishing.
 */
type Refusal = EvidenceStatus | "unsettled";

interface Bucket {
  hits: SignalBasis[];
  /** Matched the vocabulary but was not current practice. */
  rejected: { quote: string; status: Refusal }[];
  /** Matched but the company says it is not happening. */
  negated: SignalBasis[];
}

const REJECTION_WORDING: Record<string, string> = {
  planned: "describe it as an intention rather than something running",
  sector_example: "describe the industry rather than this company",
};

/**
 * The signals this company's evidence supports.
 *
 * THE LADDER, WHICH IS ORDINAL AND NOT A SCORE. Two or more independent
 * statements, or one statement with a settled figure behind it, is HIGH. One
 * statement is MEDIUM. Only the company saying it is not so is LOW. Anything
 * that matched and was refused leaves the dimension UNKNOWN with the refusal
 * named. Nothing is averaged and nothing is weighted, because there is no
 * defensible weighting here and a number would imply one.
 */
export function deriveSignals(evidence: CompanyEvidence | null | undefined): CompanySignal[] {
  if (!evidence) return [];

  const buckets = new Map<SignalDimension, Bucket>();
  const bucket = (d: SignalDimension): Bucket => {
    let b = buckets.get(d);
    if (!b) {
      b = { hits: [], rejected: [], negated: [] };
      buckets.set(d, b);
    }
    return b;
  };

  const typeAt = (i: number): EvidenceType | null =>
    evidence.sources[i]?.evidenceType ?? null;

  for (const st of evidence.statements) {
    const text = st.text.trim();
    if (!text) continue;
    for (const dim of allDimensions()) {
      const hit = (c: string) => VOCABULARY[dim].some((re) => re.test(c));
      if (!hit(text)) continue;
      // Judged on the clause the vocabulary landed in, not on the sentence
      // around it. A different clause's negation is a different claim.
      const status = classifyStatement(relevantClause(text, hit));
      const b = bucket(dim);
      if (isCurrentPractice(status)) {
        b.hits.push({
          quote: text,
          sourceIndex: st.sourceIndex,
          kind: "statement",
          evidenceType: typeAt(st.sourceIndex),
        });
      } else if (status === "negated") {
        b.negated.push({
          quote: text,
          sourceIndex: st.sourceIndex,
          kind: "statement",
          evidenceType: typeAt(st.sourceIndex),
        });
      } else {
        b.rejected.push({ quote: text, status });
      }
    }
  }

  // The one fact-driven contribution, and the place PART 8 is enforced: an
  // employee count the product could not settle raises nothing at all, and says
  // so, rather than quietly becoming evidence of scale.
  for (const m of evidence.financials) {
    if (!EMPLOYEE_METRIC.test(m.metric)) continue;
    const b = bucket("labour_intensity");
    if (!m.usable || !m.reconciliation.chosen) {
      b.rejected.push({ quote: m.reconciliation.why, status: "unsettled" });
      continue;
    }
    const chosen = m.reconciliation.chosen;
    if (chosen.currency !== null) continue; // A money figure is not a headcount.
    if (chosen.value < LARGE_WORKFORCE) continue;
    b.hits.push({
      quote: `${chosen.asStated} employees, settled across the sources`,
      sourceIndex: chosen.sourceIndex,
      kind: "reconciled_fact",
      evidenceType: chosen.evidenceType,
    });
  }

  const out: CompanySignal[] = [];
  for (const dim of allDimensions()) {
    const b = buckets.get(dim);
    if (!b) continue;
    const label = DIMENSION_LABEL[dim];

    if (b.hits.length > 0) {
      const sources = new Set(b.hits.map((h) => h.sourceIndex));
      const reported = b.hits.some((h) => h.kind === "reconciled_fact");
      const high = b.hits.length >= 2 || reported;
      out.push({
        dimension: dim,
        state: high ? "HIGH" : "MEDIUM",
        basis: b.hits,
        evidenceState: reported ? "company_reported" : "company_stated",
        reason: high
          ? `${cap(label)} is evidenced by ${b.hits.length} of this company's own ${b.hits.length === 1 ? "sources" : "statements"}${sources.size > 1 ? `, across ${sources.size} sources` : ""}.`
          : `${cap(label)} is evidenced by a single statement from this company's own sources, so it is carried as a lead rather than an established feature.`,
      });
      continue;
    }

    if (b.negated.length > 0) {
      out.push({
        dimension: dim,
        state: "LOW",
        basis: b.negated,
        evidenceState: "company_stated",
        reason: `This company's own sources say ${label} is not present, so it is recorded as low rather than left unknown.`,
      });
      continue;
    }

    if (b.rejected.length > 0) {
      const why = rejectionReason(b.rejected);
      out.push({
        dimension: dim,
        state: "UNKNOWN",
        basis: [],
        evidenceState: "unresolved",
        reason: `Something was retrieved touching ${label}, but the sources ${why}, so nothing is claimed.`,
      });
    }
  }
  return out;
}

function rejectionReason(rejected: { quote: string; status: Refusal }[]): string {
  // The most disqualifying reason wins the explanation, not the last to arrive.
  if (rejected.some((r) => r.status === "unsettled")) {
    return "did not settle on one figure";
  }
  if (rejected.some((r) => r.status === "planned")) return REJECTION_WORDING.planned;
  return REJECTION_WORDING.sector_example;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ------------------------------------------------- what a signal makes relevant
//
// The join between what is true of this company and which workflow it argues
// for. Keyed on the workflow catalogue's own categories, so it cannot drift
// from what the catalogue actually holds.
//
// `ai_adoption_maturity` maps to nothing on purpose. Knowing a company already
// runs AI does not make any particular workflow relevant; it changes how
// feasible every workflow is, which is a different job and is done by the
// priority ladder. Forcing it into this map would attach a rationale to areas
// it does not argue for.

export interface Relevance {
  /** Workflow categories this signal argues for. */
  categories: string[];
  /** True where the signal argues for anything a regulator touches. */
  regulated?: boolean;
}

export const SIGNAL_RELEVANCE: Readonly<Record<SignalDimension, Relevance>> = {
  cost_pressure: {
    categories: ["Operations", "Finance", "Procurement", "Productivity", "Supply Chain"],
  },
  margin_pressure: {
    categories: ["Finance", "Procurement", "Revenue", "Supply Chain"],
  },
  customer_service_intensity: { categories: ["Customer"] },
  labour_intensity: { categories: ["HR", "Operations", "Productivity"] },
  digital_maturity: { categories: ["Engineering", "IT", "Data"] },
  ai_adoption_maturity: { categories: [] },
  data_intensity: { categories: ["Data", "Marketing"] },
  legacy_dependency: { categories: ["IT", "Engineering"] },
  regulatory_exposure: {
    categories: ["Legal", "Risk", "Financial Services"],
    regulated: true,
  },
  cyber_trust_exposure: { categories: ["Security", "Risk"] },
  supply_chain_complexity: {
    categories: ["Supply Chain", "Procurement", "Manufacturing"],
  },
  customer_experience_pressure: { categories: ["Customer", "Marketing"] },
  growth_pressure: { categories: ["Revenue", "Marketing"] },
  process_standardisation: {
    categories: ["Operations", "Productivity", "Manufacturing"],
  },
};

/**
 * How a workflow in this category creates value against this pressure.
 *
 * MECHANISM, NEVER A RETURN. Each of these says what the work would do, and
 * none of them says what it would be worth: this product knows the company's
 * sector and a handful of retrieved sentences, which is nowhere near enough to
 * put a number on a saving. A mechanism a reader can disagree with is worth
 * more than a figure they cannot check.
 */
export const VALUE_MECHANISM: Readonly<Record<SignalDimension, string>> = {
  cost_pressure: "takes cost out of work the company is already doing",
  margin_pressure: "protects margin by lowering the cost of serving the same demand",
  customer_service_intensity: "absorbs contact volume that currently reaches a person",
  labour_intensity: "gives a large workforce leverage on work it already carries",
  digital_maturity: "builds on channels and platforms the company already runs",
  ai_adoption_maturity: "extends a capability the company has already stood up",
  data_intensity: "turns data the company already holds into something it can act on",
  legacy_dependency: "works around systems that are expensive to change",
  regulatory_exposure: "makes an obligation the company already carries cheaper to meet",
  cyber_trust_exposure: "shortens the time between something happening and someone knowing",
  supply_chain_complexity: "makes a network with many moving parts legible",
  customer_experience_pressure: "closes the gap between what customers meet and what was intended",
  growth_pressure: "adds capacity for growth without adding cost at the same rate",
  process_standardisation: "applies to work that is already the same every time",
};

/** Signals strong enough to argue for a workflow. UNKNOWN and LOW never do. */
export function argues(s: CompanySignal): boolean {
  return s.state === "HIGH" || s.state === "MEDIUM";
}

/**
 * The signals that make this workflow materially relevant to this company.
 *
 * Returned in strength order so the strongest argument leads the explanation.
 */
export function signalsFor(
  signals: readonly CompanySignal[],
  workflow: { category: string; regulatoryFlags: string[] }
): CompanySignal[] {
  return signals
    .filter(argues)
    .filter((s) => {
      const rel = SIGNAL_RELEVANCE[s.dimension];
      if (rel.categories.includes(workflow.category)) return true;
      return Boolean(rel.regulated) && workflow.regulatoryFlags.length > 0;
    })
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "HIGH" ? -1 : 1));
}
