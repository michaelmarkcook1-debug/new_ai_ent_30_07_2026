// Where AI could go in the company Your AI Position just researched.
//
// WHY THIS IS DERIVED AND NOT WRITTEN. Michael asked the page to take a stand
// on potential AI usage rather than only reporting what sources said. The
// research prompt forbids exactly that: "do not carry in anything you know
// about this company that the passages do not contain". Both are right, and
// they are reconciled by taking the stand from OUR data rather than from the
// model's impression of the company.
//
// The research places the company in one of the fifteen sectors the workflow
// catalogue carries (`sectorTag`). The catalogue then already knows which of
// its 75 workflows that sector actually runs, what each one's risk tier is,
// and what reliability it demands. So "where could AI go at a bank" is a
// lookup against a curated library, not a guess about that bank.
//
// THREE CLASSES, NEVER MERGED. A reader deciding where to spend needs to know
// which kind of thing each line is:
//
//   evidenced  the retrieved sources say this company is doing it now
//   derived    no source names it, but something the sources DO establish about
//              this company makes it materially relevant
//   sector     the catalogue holds it for this sector and nothing retrieved
//              connects it to this company
//
// THE MIDDLE ONE IS WHY THIS FILE CHANGED. With only the outer two, almost
// every line was "sector", because a company's retrieved sources rarely name a
// specific workflow. So the page was mostly a list of what a retailer might do,
// which is true of every retailer and therefore tells this reader nothing. The
// derived class is the one that carries actual judgement, and it is the one
// that has to be policed hardest.
//
// THE GATE THAT POLICES IT (Part 9). "If I swapped this company for another in
// the same sector, would the rationale still work?" It is not asked of a model.
// It is answered structurally: a derived area must carry at least one quote
// from THIS company's own retrieved sources, and lib/position/company-signals.ts
// cannot read the sector tag at all, so no rationale can be built from anything
// a competitor also has. An area that cannot answer "why this company?" out of
// company evidence is not derived. It stays sector.
//
// A sector area is a prompt to go and look, not a claim that they do it. The
// label says so.
//
// SAFE FROM EITHER SIDE. Pure functions over bundled data, no fs and no
// network, so a client component may import it. That claim was false when
// first written: this read WORKFLOW_CATEGORY_MAP out of lib/workflow-vendors,
// which also exports a loader reaching `node:fs`, and the whole graph came
// with it. The map now lives in lib/workflow-category-map.ts on its own.
// Typecheck and 607 tests all passed with the bad import; only `next build`
// caught it.

import { USE_CASES, type UseCase, type IndustryTag } from "@/lib/aie/use-cases";
import { TAG_LABEL } from "@/lib/exposure/vertical";
import { CATEGORY_MAP as WORKFLOW_CATEGORY_MAP } from "@/lib/workflow-category-map";
import {
  classifyStatement,
  deriveSignals,
  isCurrentPractice,
  relevantClause,
  signalsFor,
  DIMENSION_LABEL,
  VALUE_MECHANISM,
  type CompanySignal,
  type EvidenceStatus,
  type SignalBasis,
} from "./company-signals";
import { alignment, bestAlignment } from "./workflow-match";
import type { AiClaim, ClaimStatus } from "@/lib/research/company";
import { reliabilityOf, type EvidenceReliability, type OpportunityClass } from "./reliability";
import type { SavedPosition } from "./store";

export interface Opportunity {
  /** The workflow's own id in the catalogue. */
  id: string;
  label: string;
  /** Its grouping, which is also what maps to a vendor market. */
  category: string;
  riskTier: UseCase["riskTier"];
  /** 1 to 5. What the catalogue says this workflow needs to be trusted with. */
  reliabilityRequirement: number;
  /** How far it may run unsupervised, per the catalogue. */
  autonomyDefault: string;
  regulatoryFlags: string[];
  /**
   * Why this area is on the list. See the three classes at the top of the file.
   *
   * DETERMINISTIC, AND NEVER THE MODEL'S CHOICE. Nothing that writes prose
   * decides this. It is computed from what the retrieved statements say and
   * from the signals derived off them, so the same evidence always produces
   * the same class and the class can be argued with by reading the quotes.
   */
  basis: OpportunityClass;
  /**
   * How the sources describe it, where they describe it at all.
   *
   * Only `deployed` and `pilot` can classify an area as evidenced. `planned`
   * is an intention, `negated` is the company saying it is not so, and
   * `sector_example` is a sentence about the industry. Each of those was
   * reaching the reader as evidence of live use before the classifier existed.
   */
  evidenceStatus: EvidenceStatus | null;
  /** The source sentence, where one exists. Never paraphrased. */
  evidence: string | null;
  /**
   * Why that sentence counts as evidence, so the badge can be interrogated
   * rather than trusted. Null wherever `evidence` is.
   */
  evidenceWhy: string | null;
  /**
   * Quotes from this company's own retrieved sources under this area.
   *
   * THE COMPANY-SPECIFICITY GATE IS THIS FIELD. Empty means nothing retrieved
   * connects the area to this company, and an area in that state cannot be
   * evidenced or derived whatever else is true of it.
   */
  companyEvidence: SignalBasis[];
  /** The signals that argue for it. Populated only where `basis` is derived. */
  derivedSignals: CompanySignal[];
  /** The answer to "why this company?". Null unless derived. */
  whyThisCompany: string | null;
  /** How the work would create value against that pressure. Never a return. */
  valueMechanism: string | null;
  /** What would actually bind, taken from the catalogue rather than guessed. */
  keyConstraint: string | null;
  /** Where it sits against the others. Ordinal, and never a score out of 100. */
  priority: Priority;
  /** Which rules moved it there, so the order can be argued with. */
  priorityWhy: string;
  /**
   * How far this company's evidence supports putting this area to them.
   *
   * NOT `reliabilityRequirement`, which is the assurance bar the WORKFLOW
   * demands and is the same for every company. See lib/position/reliability.ts
   * for why both exist and why neither can do the other's job.
   */
  reliability: EvidenceReliability;
  /** Market categories a buyer would shop in for this area. */
  marketIds: string[];
}

/** Where an area sits against the others. Three steps, and each one is argued. */
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface PositionOpportunities {
  sectorTag: string;
  sectorLabel: string;
  areas: Opportunity[];
  evidencedCount: number;
  derivedCount: number;
  sectorCount: number;
  /**
   * Everything the evidence established about this company, whether or not it
   * argued for an area. Carried so a reader can see what the classification
   * was working from, including the dimensions that came back UNKNOWN.
   */
  signals: CompanySignal[];
  /** Market categories across every area, most-supported first. */
  marketIds: string[];
  /** The single market the Decision Desk should open on. Null if none. */
  leadMarketId: string | null;
  /**
   * The three areas the weighting and the situation line are actually built
   * from. Read this rather than `areas` when making a claim about the company.
   */
  lead: Opportunity[];
  /** Highest risk tier among the LEAD areas, which drives the weighting. */
  topRisk: UseCase["riskTier"];
  /**
   * Regulatory flags carried by the LEAD areas only, deduplicated.
   *
   * Aggregated across all eight this said "BASEL_III, EU_AI_Act, FINRA, GDPR,
   * HIPAA, MiFID_II, PCI_DSS and SOX apply" for a retail bank. HIPAA does not
   * apply to a bank: it was carried by a workflow far down the list that the
   * bank would never run. A flag is a fact about a workflow, and asserting it
   * of the company is only defensible for the areas actually being put to them.
   */
  regulatoryFlags: string[];
}

/**
 * Regulatory flags, as a reader would write them.
 *
 * The catalogue keys these as identifiers (`EU_AI_Act`, `FDA_21CFR11`) and
 * they were reaching the screen unchanged, which is the same defect as leaking
 * a raw taxonomy id into prose: it has shipped twice before in this product.
 * An unmapped flag falls back to its identifier with underscores spaced, which
 * is still readable, so a new flag degrades rather than breaking.
 */
const FLAG_LABEL: Record<string, string> = {
  EU_AI_Act: "the EU AI Act",
  GDPR: "GDPR",
  HIPAA: "HIPAA",
  SOX: "SOX",
  CCPA: "CCPA",
  FINRA: "FINRA",
  MiFID_II: "MiFID II",
  BASEL_III: "Basel III",
  PCI_DSS: "PCI DSS",
  FERPA: "FERPA",
  FDA_21CFR11: "FDA 21 CFR Part 11",
  ISO_27001: "ISO 27001",
  SOC2: "SOC 2",
};

export function flagLabel(flag: string): string {
  return FLAG_LABEL[flag] ?? flag.replace(/_/g, " ");
}

const RISK_ORDER: Record<UseCase["riskTier"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Workflows this sector runs.
 *
 * A workflow with an empty `industries` array is horizontal and belongs to
 * every sector; the catalogue says so in its own comment. Those are included
 * but rank below sector-specific ones, because "you could use a meeting
 * assistant" is true of everyone and tells this reader nothing.
 */
function workflowsForSector(tag: string): { uc: UseCase; specific: boolean }[] {
  const out: { uc: UseCase; specific: boolean }[] = [];
  for (const uc of USE_CASES) {
    const inds = uc.industries ?? [];
    if (inds.length === 0) out.push({ uc, specific: false });
    else if (inds.includes(tag as IndustryTag)) out.push({ uc, specific: true });
  }
  return out;
}

/**
 * Does anything the sources said touch this workflow?
 *
 * Matched on the workflow's own label words against the research statements.
 * Deliberately crude and deliberately conservative: a miss costs a "sector"
 * label where "evidenced" was available, which understates. A false match
 * would put a claim about the company on screen that its sources never made,
 * which is the failure that matters.
 */
/**
 * Whether a company's own statements evidence this workflow, and how.
 *
 * WHAT THIS REPLACES. The original rule was two shared words of the workflow
 * label appearing anywhere in any statement. That promoted a sector hypothesis
 * to company evidence on token overlap alone: it could not see negation, could
 * not see intention, and could not tell the company from the industry it sits
 * in.
 *
 * THE NEGATION AND INTENTION LISTS NOW LIVE IN ONE PLACE. They used to be
 * duplicated here, and a statement that classified one way when deciding
 * whether a workflow was evidenced could classify another way when deriving a
 * signal off the same sentence. `classifyStatement()` is the single answer to
 * "what is this sentence saying", and both callers ask it.
 *
 * It is still lexical, and that is a real limit stated plainly rather than
 * dressed up: this does not understand the sentence. What it does is refuse the
 * readings it can detect are wrong and require real overlap before claiming
 * evidence, so the failures it has left are misses rather than false claims. A
 * missed evidenced area appears further down the list, which understates what
 * the company does; a false one tells the reader something untrue about their
 * own business.
 */
/**
 * Everything an EVIDENCED classification has to survive, and what carried it.
 *
 * Held so the classification is auditable rather than asserted: the statement,
 * the source it cites, the status it was read at, and the rare catalogue terms
 * the alignment turned on. Part 9's rule is structural rather than a promise:
 * this is recomputed from the statement on every render, so if the supporting
 * passage goes, the classification goes with it. Nothing persists a verdict.
 */
export interface EvidenceHit {
  statement: string;
  sourceIndex: number;
  status: EvidenceStatus;
  why: string;
  /** The catalogue terms that made the match arguable. */
  terms: string[];
}

/**
 * Which workflows this company's own sources evidence, and on what.
 *
 * WHAT THIS REPLACES. Two of a workflow label's words appearing in a sentence,
 * plus a head-noun check bolted on after two live false positives. That rule
 * could not recognise the same activity written differently and could not tell
 * a description from a coincidence. See lib/position/workflow-match.ts.
 *
 * THE FIVE CONDITIONS, all required, and the model is the final authority on
 * none of them:
 *
 *   1 subject      the sentence is about THIS company. A competitor's
 *                  deployment, a supplier's product and an industry trend are
 *                  three different things and none of them is this company
 *   2 affirmative  not negated
 *   3 alignment    the passage describes the workflow, judged against the
 *                  catalogue's own description of it
 *   4 status       DEPLOYED or PILOT. An intention, an exploration, a signed
 *                  agreement and a job advert are not use
 *   5 provenance   a retrieved source it can be traced to
 *
 * WHERE THE MODEL FITS. It reads the passage and reports subject, status and
 * capability, which is knowledge no amount of post-hoc parsing recovers. Then
 * every field is checked against the sentence: `classifyStatement()` reads the
 * status independently and THE STRICTER OF THE TWO WINS, so a model answering
 * DEPLOYED over a sentence that says "plans to" is overruled, and a model
 * answering PLANNED over a deployment is taken at its word. A statement with no
 * structured claim at all, which is every position saved before this existed,
 * is judged on the sentence alone and can still evidence a workflow.
 */
function evidencedWorkflows(
  candidates: readonly { uc: UseCase }[],
  statements: readonly PositionStatement[]
): Map<string, EvidenceHit> {
  const out = new Map<string, EvidenceHit>();
  const catalogue = candidates.map((c) => c.uc);

  // Where the research classified anything at all, an unclassified statement is
  // one the model declined to call an AI deployment, and that is an answer.
  // Where it classified nothing, the position predates the structured contract
  // and every statement is judged on its own words.
  const structured = statements.some((s) => s.claim);

  for (const s of statements) {
    const claim = s.claim;

    // 0. A business finding describes the company. An AI finding describes its
    //    AI. Only the second can evidence an AI workflow, and pooling them let
    //    a sentence about revenue estimates reach a workflow classification.
    if (s.ai === false) continue;

    if (structured && !claim) continue;

    // 1. Subject. The model's answer where it gave one, and the sentence's own
    //    reading either way: a sentence about the industry is refused whatever
    //    the model called it.
    if (claim && claim.subject !== "company") continue;

    // 4a. Status as the model read it, before the sentence is consulted.
    if (claim && !MODEL_CURRENT.has(claim.status)) continue;

    // 3. Alignment, over the sentence and the capability the model named. The
    //    capability is additional evidence for the mapping and never a
    //    substitute for the passage: on its own it is the model's summary of
    //    itself.
    const text = claim?.capability ? `${s.text} ${claim.capability}` : s.text;
    const best = bestAlignment(text, catalogue);
    if (!best) continue;

    // 2 and 4b. The sentence's own reading, on the clause the match landed in.
    //    Whichever of the two readings is stricter is the one that stands.
    const label = best.uc.label.toLowerCase();
    const status = classifyStatement(
      relevantClause(s.text, (c) => alignment(c, best.uc).aligned) || s.text
    );
    if (!isCurrentPractice(status)) continue;

    // 5. Provenance. A statement whose source cannot be named cannot be traced,
    //    and an untraceable claim about a company's own systems is exactly the
    //    kind this product refuses to make.
    if (s.sourceIndex < 0) continue;

    // The strictest status of the two readings.
    const settled: EvidenceStatus =
      claim?.status === "PILOT" || status === "pilot" ? "pilot" : "deployed";

    if (out.has(best.uc.id)) continue;
    out.set(best.uc.id, {
      statement: s.text,
      sourceIndex: s.sourceIndex,
      status: settled,
      terms: best.alignment.distinctive,
      why:
        `The company's own sources describe ${label} in terms the catalogue uses for it (${best.alignment.distinctive
          .slice(0, 3)
          .join(", ")}), as ${settled === "pilot" ? "something running in pilot" : "current practice"}.`,
    });
  }
  return out;
}

/** The two model statuses that are current practice. Nothing else is. */
const MODEL_CURRENT: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  "DEPLOYED",
  "PILOT",
]);

/** A statement as the position carries it. */
type PositionStatement = {
  text: string;
  sourceIndex: number;
  ai?: boolean;
  claim?: AiClaim;
};

/**
 * The one sentence a derived area exists to answer.
 *
 * Built from the strongest signal arguing for the area, and it names both the
 * dimension and the workflow's own category, because the join between them is
 * the argument. A reader who disagrees can see exactly which quote and which
 * category produced it.
 */
function whyThisCompanyLine(uc: UseCase, lead: CompanySignal): string {
  const quote = lead.basis[0]?.quote ?? "";
  const trimmed = quote.length > 180 ? `${quote.slice(0, 177)}...` : quote;
  return `Your own sources establish ${DIMENSION_LABEL[lead.dimension]} at this company: "${trimmed}". ${uc.label} is ${uc.category} work, which is where that lands.`;
}

/**
 * What would actually bind, if they took it forward.
 *
 * Every clause comes from the catalogue's own record of the workflow. Nothing
 * here is inferred about the company, because the constraint is a property of
 * the work rather than of who is doing it.
 */
function constraintLine(uc: UseCase): string {
  const flags = (uc.regulatoryFlags ?? []).map(flagLabel);
  const regulated =
    flags.length > 0
      ? ` It is bound by ${flags.length === 1 ? flags[0] : `${flags.slice(0, -1).join(", ")} and ${flags[flags.length - 1]}`}.`
      : "";
  const autonomy =
    uc.autonomyDefault === "advisory_only"
      ? " The catalogue holds it as advisory only, so a person stays in the loop by default."
      : "";
  return `${cap(uc.riskTier)} risk work needing ${uc.reliabilityRequirement} of 5 on the assurance bar before a system can be trusted with it.${regulated}${autonomy}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The areas, ranked.
 *
 * Returns null when the research could not place the company in a sector.
 * That is a real outcome: `placeSector()` returns null rather than guessing,
 * and inventing a sector here to fill the panel would defeat it.
 */
export function opportunitiesFor(
  position: SavedPosition
): PositionOpportunities | null {
  const tag = position.sectorTag;
  if (!tag || !TAG_LABEL[tag]) return null;

  const candidates = workflowsForSector(tag);
  if (candidates.length === 0) return null;

  // Statements with the source each cites, where the position carries them.
  // A position saved before the evidence block existed falls back to the flat
  // arrays with no attribution, which still lets a workflow be evidenced and
  // correctly lets nothing be derived: a signal needs a source it can name.
  const attributed =
    position.evidence?.statements ??
    [...position.aiFindings, ...position.findings].map((text) => ({
      text,
      sourceIndex: -1,
    }));

  // Everything the evidence establishes about this company. Derived here, once,
  // so every consumer of this object reads the same conclusions rather than
  // each re-deriving its own. Nothing in here has seen the sector tag.
  const signals = deriveSignals(position.evidence);

  // An unresolved figure is a fact about the whole retrieved record, so it
  // lowers reliability everywhere rather than only on the metric it came from.
  const unresolvedConflict = (position.evidence?.financials ?? []).some(
    (m) =>
      m.reconciliation.verdict === "CONFLICTING" ||
      (m.reconciliation.verdict === "INSUFFICIENT" && m.reconciliation.facts.length > 1)
  );

  const specificIds = new Set(
    candidates.filter((c) => c.specific).map((c) => c.uc.id)
  );

  // Computed once over the statements rather than once per workflow, because
  // the question is "what does this sentence describe", not "does this workflow
  // appear in this sentence". Asking it the old way let one statement evidence
  // several unrelated workflows at once.
  //
  // AND ASKED OF THE WHOLE CATALOGUE, not only of this sector's workflows.
  // Found on live Ocado research, 30 August 2026: its own sources say machine
  // learning already schedules predictive maintenance in the fulfilment
  // centres, and the product showed nothing, because the catalogue lists
  // Predictive Maintenance under manufacturing, energy and transport rather
  // than retail. The sector list is a prior about what a sector TYPICALLY runs.
  // A company's own sources saying it runs something are evidence, and evidence
  // outranks a prior. So an evidenced workflow joins this company's list
  // wherever the catalogue files it, and the sector list keeps governing
  // derived and sector areas, which is the job it is actually good at.
  const evidenced = evidencedWorkflows(
    USE_CASES.map((uc) => ({ uc })),
    attributed
  );

  const extra = USE_CASES.filter(
    (uc) => evidenced.has(uc.id) && !candidates.some((c) => c.uc.id === uc.id)
  ).map((uc) => ({ uc, specific: false }));
  const all = [...candidates, ...extra];

  const areas: Opportunity[] = all.map(({ uc }) => {
    const hit = evidenced.get(uc.id) ?? null;
    const arguing = hit ? [] : signalsFor(signals, {
      category: uc.category,
      regulatoryFlags: uc.regulatoryFlags ?? [],
    });

    // The quotes under this area, whichever class it lands in. This is the
    // field the company-specificity gate reads.
    const companyEvidence: SignalBasis[] = hit
      ? [
          {
            quote: hit.statement,
            sourceIndex: hit.sourceIndex,
            kind: "statement",
            evidenceType:
              position.evidence?.sources[hit.sourceIndex]?.evidenceType ?? null,
          },
        ]
      : arguing.flatMap((sig) => sig.basis);

    // THE GATE. Derived requires a quote from this company. Without one the
    // rationale would survive swapping the company for any competitor, which
    // is exactly what "sector" means.
    const derived = !hit && arguing.length > 0 && companyEvidence.length > 0;
    const cls: OpportunityClass = hit ? "evidenced" : derived ? "derived" : "sector";

    const lead = arguing[0] ?? null;
    const reliability = reliabilityOf({
      classification: cls,
      sourceTypes: companyEvidence.map((e) => e.evidenceType),
      sourceIndices: companyEvidence
        .map((e) => e.sourceIndex)
        .filter((i) => i >= 0),
      signals: cls === "derived" ? arguing : [],
      unresolvedConflict,
    });

    const { priority, priorityWhy } = priorityOf({ cls, uc, signals, arguing });

    return {
      id: uc.id,
      label: uc.label,
      category: uc.category,
      riskTier: uc.riskTier,
      reliabilityRequirement: uc.reliabilityRequirement,
      autonomyDefault: uc.autonomyDefault,
      regulatoryFlags: uc.regulatoryFlags ?? [],
      basis: cls,
      evidenceStatus: hit?.status ?? null,
      evidence: hit?.statement ?? null,
      evidenceWhy: hit?.why ?? null,
      companyEvidence: cls === "sector" ? [] : companyEvidence,
      derivedSignals: cls === "derived" ? arguing : [],
      whyThisCompany: cls === "derived" && lead ? whyThisCompanyLine(uc, lead) : null,
      valueMechanism: cls === "derived" && lead ? VALUE_MECHANISM[lead.dimension] : null,
      keyConstraint: cls === "derived" ? constraintLine(uc) : null,
      priority,
      priorityWhy,
      reliability,
      marketIds: WORKFLOW_CATEGORY_MAP[uc.category] ?? [],
    };
  });

  // Priority first, then the class behind it, then sector-specific over
  // horizontal, then risk. Priority leads because it is the thing the ladder
  // exists to express; the rest break its ties in the order they used to sort.
  const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const CLASS_ORDER: Record<OpportunityClass, number> = {
    evidenced: 0,
    derived: 1,
    sector: 2,
  };
  areas.sort((a, b) => {
    if (a.priority !== b.priority) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    if (a.basis !== b.basis) return CLASS_ORDER[a.basis] - CLASS_ORDER[b.basis];
    const aSpec = specificIds.has(a.id);
    const bSpec = specificIds.has(b.id);
    if (aSpec !== bSpec) return aSpec ? -1 : 1;
    return RISK_ORDER[b.riskTier] - RISK_ORDER[a.riskTier];
  });

  const top = areas.slice(0, 8);

  // Market categories weighted by how many of the top areas point at them, so
  // the lead market is the one the reader's own areas most call for rather
  // than whichever happened to sort first.
  const tally = new Map<string, number>();
  for (const a of top) {
    for (const m of a.marketIds) tally.set(m, (tally.get(m) ?? 0) + 1);
  }
  const marketIds = [...tally.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([m]) => m);

  // The three put to the reader. Everything asserted about the company is
  // computed from these rather than from all eight, because a max taken over
  // eight workflows saturates: every sector holds something critical and
  // something flagged, so the weighting came out identical for a bank, a
  // hospital, a retailer and a factory, which is a weighting that discriminates
  // nothing.
  const lead = top.slice(0, 3);

  const topRisk = lead.reduce<UseCase["riskTier"]>(
    (acc, a) => (RISK_ORDER[a.riskTier] > RISK_ORDER[acc] ? a.riskTier : acc),
    "low"
  );

  return {
    sectorTag: tag,
    sectorLabel: TAG_LABEL[tag],
    areas: top,
    evidencedCount: top.filter((a) => a.basis === "evidenced").length,
    derivedCount: top.filter((a) => a.basis === "derived").length,
    sectorCount: top.filter((a) => a.basis === "sector").length,
    signals,
    marketIds,
    leadMarketId: marketIds[0] ?? null,
    lead,
    topRisk,
    regulatoryFlags: [...new Set(lead.flatMap((a) => a.regulatoryFlags))].sort(),
  };
}

/**
 * Where an area sits against the others, and which rules put it there.
 *
 * THREE STEPS, NOT A SCORE. An 83-out-of-100 implies a precision this evidence
 * cannot carry: the inputs are a sector placement, a handful of retrieved
 * sentences and a catalogue entry, and no arithmetic over those produces a
 * second significant figure that means anything. So the ladder is ordinal, each
 * step is one rule, and every rule that fired is named on screen.
 *
 * THE RULES, IN ORDER.
 *
 *   base           evidenced 3, derived 2, sector 1
 *   +1 converging  derived, and the signal arguing for it is HIGH rather than
 *                  a single statement
 *   -1 unproven    the company evidences no AI in production and this workflow
 *                  needs 4+ on the assurance bar or runs as an agent. Starting
 *                  there is the least feasible thing on the list
 *   -1 legacy      the sources establish legacy dependency and this is
 *                  engineering, IT or data work, which is where that bites
 *   clamp          1 to 3
 *
 * WHAT IS DELIBERATELY NOT A STEP, having been one and been wrong. A first cut
 * marked down any workflow the catalogue holds for every sector rather than for
 * this one. Run against live Tesco research it put all five derived areas at
 * LOW, level with the sector areas, because the workflows company evidence
 * argues for are frequently the horizontal ones. That cancels the very signal
 * just derived: a horizontal workflow the company's own sources point at is
 * specific to them, and the fact that it is also available to everyone else is
 * beside the point. Horizontality still breaks ties in the sort, which is where
 * it belongs.
 *
 * WHY AI MATURITY ONLY EVER SUBTRACTS. LOW is a specific incompatibility: no AI
 * in production is a bad place to start a workflow that has to run unsupervised
 * or clear a 4-of-5 assurance bar. HIGH is not the mirror of that. It says the
 * company could take on any of these, which raises everything equally and
 * therefore ranks nothing, so it is left to do its work through relevance
 * instead.
 */
function priorityOf(args: {
  cls: OpportunityClass;
  uc: UseCase;
  signals: readonly CompanySignal[];
  arguing: readonly CompanySignal[];
}): { priority: Priority; priorityWhy: string } {
  const { cls, uc, signals, arguing } = args;
  const steps: string[] = [];

  let score = cls === "evidenced" ? 3 : cls === "derived" ? 2 : 1;
  steps.push(
    cls === "evidenced"
      ? "high because this company's own sources place it in current practice"
      : cls === "derived"
        ? `medium because ${arguing.length === 1 ? "a company signal makes" : `${arguing.length} company signals make`} it relevant here`
        : "low because nothing retrieved connects it to this company"
  );

  if (cls === "derived" && arguing[0]?.state === "HIGH") {
    score += 1;
    steps.push(
      "up one because the signal arguing for it rests on more than a single statement"
    );
  }

  const aiMaturity = signals.find((s) => s.dimension === "ai_adoption_maturity");
  const unproven = aiMaturity?.state === "LOW";
  if (
    unproven &&
    (uc.reliabilityRequirement >= 4 || uc.autonomyDefault !== "advisory_only")
  ) {
    score -= 1;
    steps.push(
      "down one because the sources say this company has no AI in production, and this is not the workflow to start on"
    );
  }

  const legacy = signals.find((s) => s.dimension === "legacy_dependency");
  if (
    legacy?.state === "HIGH" &&
    ["Engineering", "IT", "Data"].includes(uc.category)
  ) {
    score -= 1;
    steps.push("down one because the sources establish legacy systems where this work would sit");
  }

  score = Math.max(1, Math.min(3, score));
  const priority: Priority = score === 3 ? "HIGH" : score === 2 ? "MEDIUM" : "LOW";
  return { priority, priorityWhy: `${priority} priority: ${steps.join("; ")}.` };
}

/**
 * The opening line the Decision Desk prefills, extended with the areas.
 *
 * Still stops before the part only the reader knows, which is the rule
 * `openingLine()` already follows: a fully written situation gets submitted
 * unread. This adds what the product established, not what the reader wants.
 */
export function situationFrom(
  position: SavedPosition,
  opp: PositionOpportunities | null
): string {
  // Lower-cased the same way openingLine() does it, because the sources write
  // `what` as a standalone sentence and it lands here mid-sentence: live Boots
  // research produced "We are Boots, A pharmacy-led health and beauty
  // retailer". An initialism keeps its capitals.
  const base = `We are ${position.name}, ${lowerFirst(position.what.trim())}`.replace(
    /\.?$/,
    ". "
  );
  if (!opp || opp.lead.length === 0) return base;

  // Attributed separately, one clause per class. A first cut said "our own
  // sources point at" and then listed all three lead areas, when typically only
  // one of them is evidenced and the rest are what the sector runs. That put a
  // claim about the company into the reader's own opening sentence, which is
  // the one place it would never be questioned.
  //
  // THE DERIVED CLAUSE IS NOT DECORATION. Without it, a company whose three
  // lead areas were all derived matched neither branch and the situation box
  // was prefilled with "We are Tesco Plc, a British multinational grocery
  // retailer. . " - a stray double stop and no areas at all. Measured on live
  // Tesco research on 30 August 2026, and it is the exact failure the third
  // class introduces if every consumer is not taught about it.
  const evidenced = opp.lead.filter((a) => a.basis === "evidenced");
  const derived = opp.lead.filter((a) => a.basis === "derived");
  const sector = opp.lead.filter((a) => a.basis === "sector");
  const name = (list: Opportunity[]) =>
    list.map((a) => a.label.toLowerCase()).join(", ");

  const parts: string[] = [];
  if (evidenced.length > 0) {
    parts.push(`Our own sources point at ${name(evidenced)}`);
  }
  if (derived.length > 0) {
    parts.push(
      parts.length > 0
        ? `and what those sources establish about us argues for ${name(derived)}`
        : `What our own sources establish about us argues for ${name(derived)}`
    );
  }
  if (sector.length > 0) {
    parts.push(
      parts.length > 0
        ? `and ${opp.sectorLabel.toLowerCase()} typically also runs ${name(sector)}`
        : `For ${opp.sectorLabel.toLowerCase()} the areas that matter are ${name(sector)}`
    );
  }
  if (parts.length === 0) return base;
  return `${base}${parts.join(" ")}. `;
}

/**
 * A starting weighting for the Decision Desk's own four dimensions.
 *
 * These are `strategic_fit`, `execution_readiness`, `governance_trust` and
 * `economics`: the dimensions `assess-decide-view.tsx` actually renders
 * sliders for. Anything else would be a weighting the page cannot apply.
 *
 * Built from PROPORTIONS across the lead areas, not maxima. A first cut took
 * the highest risk tier and the highest reliability requirement, and returned
 * an identical weighting for a bank, a hospital, a retailer, a factory, a
 * school, a law firm and a software company: every sector's most valuable AI
 * workflows are high-risk and reliability-critical, so a max saturates
 * immediately. A weighting that never varies is not a weighting.
 *
 * It is a starting point, not advice. The Decision Desk already says the
 * scores never move and only the weights do; this decides where they start,
 * and every slider stays draggable.
 */
export interface StartingWeights {
  strategic_fit: number;
  execution_readiness: number;
  governance_trust: number;
  economics: number;
  /** Stated on screen, so a reader can disagree with the reasoning. */
  why: string;
}

export function weightingFrom(
  opp: PositionOpportunities | null
): StartingWeights {
  // The Decision Desk's own balanced preset, used unchanged when there is
  // nothing to derive from.
  if (!opp || opp.lead.length === 0) {
    return {
      strategic_fit: 0.3,
      execution_readiness: 0.25,
      governance_trust: 0.25,
      economics: 0.2,
      why: "No sector was established for this company, so the balanced preset is used unchanged.",
    };
  }

  const n = opp.lead.length;
  const criticalShare =
    opp.lead.filter((a) => RISK_ORDER[a.riskTier] >= 3).length / n;
  const heavyShare =
    opp.lead.filter((a) => RISK_ORDER[a.riskTier] >= 2).length / n;
  const avgReliability =
    opp.lead.reduce((t, a) => t + a.reliabilityRequirement, 0) / n;
  const flagLoad = Math.min(opp.regulatoryFlags.length, 6) / 6;

  // Raw pulls, then normalised, so the four always sum to 1 whatever the mix.
  const raw = {
    strategic_fit: 0.30,
    execution_readiness: 0.20 + 0.20 * ((avgReliability - 1) / 4),
    governance_trust: 0.15 + 0.25 * (0.5 * criticalShare + 0.5 * flagLoad),
    economics: 0.20 - 0.10 * heavyShare,
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const r2 = (x: number) => Math.round((x / sum) * 100) / 100;

  return {
    strategic_fit: r2(raw.strategic_fit),
    execution_readiness: r2(raw.execution_readiness),
    governance_trust: r2(raw.governance_trust),
    economics: r2(raw.economics),
    why:
      `Derived from your three lead areas: ` +
      `${Math.round(criticalShare * 100)} per cent sit at critical risk, ` +
      `mean reliability requirement is ${avgReliability.toFixed(1)} of 5, and ` +
      `${regulatoryFlagSentence(opp.regulatoryFlags)}. ` +
      `Every slider stays yours to move.`,
  };
}

/** Only where the word is not itself a name or an initialism. */
function lowerFirst(s: string): string {
  if (/^[A-Z]{2,}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function regulatoryFlagSentence(flags: string[]): string {
  if (flags.length === 0) return "these areas carry no regulatory flags";
  const named = flags.map(flagLabel);
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `these areas carry ${list}`;
}
