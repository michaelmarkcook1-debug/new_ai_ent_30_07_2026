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
// TWO CLASSES, NEVER MERGED. An area the company's own sources mention is a
// different kind of fact from an area its sector typically runs, and a reader
// deciding where to spend needs to see which is which:
//
//   evidenced  the retrieved sources said something about this area
//   sector     the catalogue holds it for this sector; the sources are silent
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
   * Why this area is on the list.
   *
   * "evidenced" means the company's own retrieved sources spoke to it.
   * "sector" means the catalogue holds it for their sector and the sources
   * said nothing, which is a place to look rather than a finding.
   */
  basis: "evidenced" | "sector";
  /** The source sentence, where one exists. Never paraphrased. */
  evidence: string | null;
  /**
   * Why that sentence counts as evidence, so the badge can be interrogated
   * rather than trusted. Null wherever `evidence` is.
   */
  evidenceWhy: string | null;
  /** Market categories a buyer would shop in for this area. */
  marketIds: string[];
}

export interface PositionOpportunities {
  sectorTag: string;
  sectorLabel: string;
  areas: Opportunity[];
  evidencedCount: number;
  sectorCount: number;
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
 * Wording that means the company is NOT doing this.
 *
 * The matcher counted shared words and nothing else, so a statement saying the
 * company has no fraud detection capability contained "fraud" and "detection"
 * and was published back to the reader as evidence that it does. Negation is
 * invisible to token overlap and it inverts the claim entirely, which makes it
 * the most expensive thing the old rule could not see.
 */
const NEGATED =
  /\b(?:no|not|never|without|lacks?|lacking|absent|does not|do not|did not|has not|have not|hasn't|haven't|doesn't|don't|declined to|failed to|yet to|no longer|ceased|discontinued)\b/i;

/**
 * Wording that means this is intention rather than practice.
 *
 * "Plans to deploy fraud detection" is a statement about the future. Reporting
 * it as evidenced AI tells a reader the company already runs something it has
 * only talked about, which is the same class of error as inventing the
 * deployment outright.
 *
 * TWO THINGS DELIBERATELY NOT IN THIS LIST, both learned by getting it wrong.
 *
 * "Piloting" is not intention. A pilot is a real deployment that is running
 * now, limited in scope rather than hypothetical, and "the bank is piloting a
 * knowledge assistant" is exactly the kind of company evidence this product
 * exists to surface. Rejecting it downgraded a real finding to a sector guess
 * and threw away the quote.
 *
 * Bare modals are not here either. "May", "could" and "will" appear constantly
 * in accurate descriptions of what a live system does, so matching them turns
 * every careful sentence about an existing deployment into a rejection. The
 * entries below are phrases that state an intention, not words that can carry
 * one.
 */
const PROSPECTIVE =
  /\b(?:plans? to|planning to|intends? to|intending to|aims? to|aiming to|expects? to|expected to|hopes? to|seeking to|set to|is considering|are considering|considering whether|exploring|evaluating|proposed|proposal|roadmap|announced plans|in talks to|has yet to|have yet to)\b/i;

/**
 * Whether a company's own statements evidence this workflow, and why.
 *
 * WHAT THIS REPLACES. The old rule was two shared words of the workflow label
 * appearing anywhere in any statement. That promoted a sector hypothesis to
 * company evidence on token overlap alone: it could not see negation, could not
 * see intention, could not tell the company from a supplier it mentions, and
 * would attach one statement to several unrelated workflows. It is the reason
 * the narrative and the opportunity basis could tell different stories, because
 * one was written by a model reading passages and the other was word counting
 * over that model's output.
 *
 * It is still lexical, and that is a real limit stated plainly rather than
 * dressed up: this does not understand the sentence. What it now does is refuse
 * the readings it can detect are wrong, and require more overlap before
 * claiming evidence, so the failures it has left are misses rather than false
 * claims. A missed evidenced area appears as a sector area, which understates
 * what the company does; a false one tells the reader something untrue about
 * their own business.
 */
function evidenceFor(
  uc: UseCase,
  statements: string[]
): { statement: string; why: string } | null {
  const words = uc.label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (words.length === 0) return null;

  for (const s of statements) {
    const hay = s.toLowerCase();
    const matched = words.filter((w) => hay.includes(w));
    // Two content words as before, and every word where the label has one or
    // two, so a short label cannot be carried by a single common term.
    if (matched.length < Math.min(2, words.length)) continue;
    if (words.length <= 2 && matched.length < words.length) continue;

    // The checks the count could not make.
    if (NEGATED.test(hay)) continue;
    if (PROSPECTIVE.test(hay)) continue;

    return {
      statement: s,
      why: `The company's own sources use ${matched.map((w) => `"${w}"`).join(" and ")} in a statement about current practice.`,
    };
  }
  return null;
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

  const statements = [...position.aiFindings, ...position.findings];
  const candidates = workflowsForSector(tag);
  if (candidates.length === 0) return null;

  const areas: Opportunity[] = candidates.map(({ uc }) => {
    const hit = evidenceFor(uc, statements);
    return {
      id: uc.id,
      label: uc.label,
      category: uc.category,
      riskTier: uc.riskTier,
      reliabilityRequirement: uc.reliabilityRequirement,
      autonomyDefault: uc.autonomyDefault,
      regulatoryFlags: uc.regulatoryFlags ?? [],
      basis: hit ? "evidenced" : "sector",
      evidence: hit?.statement ?? null,
      evidenceWhy: hit?.why ?? null,
      marketIds: WORKFLOW_CATEGORY_MAP[uc.category] ?? [],
    };
  });

  // Evidenced first, then sector-specific over horizontal, then by risk, so
  // the areas that carry the most consequence surface without a reader
  // scrolling. Horizontal workflows are true of everyone and rank last.
  const specificIds = new Set(
    candidates.filter((c) => c.specific).map((c) => c.uc.id)
  );
  areas.sort((a, b) => {
    if ((a.basis === "evidenced") !== (b.basis === "evidenced")) {
      return a.basis === "evidenced" ? -1 : 1;
    }
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
    sectorCount: top.filter((a) => a.basis === "sector").length,
    marketIds,
    leadMarketId: marketIds[0] ?? null,
    lead,
    topRisk,
    regulatoryFlags: [...new Set(lead.flatMap((a) => a.regulatoryFlags))].sort(),
  };
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
  const base = `We are ${position.name}, ${position.what}`.replace(/\.?$/, ". ");
  if (!opp || opp.lead.length === 0) return base;

  // Attributed separately. A first cut said "our own sources point at" and
  // then listed all three lead areas, when typically only one of them is
  // evidenced and the rest are what the sector runs. That put a claim about
  // the company into the reader's own opening sentence, which is the one place
  // it would never be questioned.
  const evidenced = opp.lead.filter((a) => a.basis === "evidenced");
  const sector = opp.lead.filter((a) => a.basis === "sector");
  const name = (list: Opportunity[]) =>
    list.map((a) => a.label.toLowerCase()).join(", ");

  const parts: string[] = [];
  if (evidenced.length > 0) {
    parts.push(`Our own sources point at ${name(evidenced)}`);
  }
  if (sector.length > 0) {
    parts.push(
      evidenced.length > 0
        ? `and ${opp.sectorLabel.toLowerCase()} typically also runs ${name(sector)}`
        : `For ${opp.sectorLabel.toLowerCase()} the areas that matter are ${name(sector)}`
    );
  }
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

function regulatoryFlagSentence(flags: string[]): string {
  if (flags.length === 0) return "these areas carry no regulatory flags";
  const named = flags.map(flagLabel);
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `these areas carry ${list}`;
}
