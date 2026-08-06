import { USE_CASES, type IndustryTag, type UseCase } from "@/lib/aie/use-cases";

// The vertical lens on a shared role.
//
// A customer care agent in investment banking is not a customer care agent in
// retail, and the role library cannot say so. Its 99 multi-industry roles carry
// one profile marked `*` that serves every sector, which the specification
// itself records as wrong (join_specification section 6) and not yet fixable
// from evidence. So the capability band for a shared role is identical in every
// vertical, and pretending otherwise would mean inventing a multiplier.
//
// What genuinely differs, and is recorded rather than assumed, is the assurance
// bar. The workflow catalogue tags each workflow with the industries it runs in
// and carries, per workflow, a risk tier, a reliability requirement from 1 to 5
// and the autonomy that is safe to default to. Those vary sharply: financial
// services runs at a mean risk of 3.33 and a reliability bar of 5.0, technology
// at 2.33 and 4.33.
//
// So the honest reading is: the model reaches the same level of work in both
// sectors, and what you are permitted to do with it differs. A capability that
// is reachable in retail as a supervised agent is reachable in banking only
// with a human in the loop. That is the difference a buyer actually feels, and
// it comes out of the catalogue rather than out of a guess.

const RISK_SCORE: Record<UseCase["riskTier"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Weakest autonomy wins: the sector is governed by its most constrained work. */
const AUTONOMY_RANK: Record<string, number> = {
  advisory_only: 0,
  human_in_loop: 1,
  supervised_agent: 2,
};

export interface VerticalLens {
  tag: IndustryTag;
  /** Workflows in the catalogue tagged to this industry. */
  workflows: number;
  /** Mean risk tier, 1 (low) to 4 (critical). */
  meanRisk: number;
  /** Mean reliability requirement, 1 to 5. */
  meanReliability: number;
  /** How many of its workflows sit at high or critical risk. */
  highRisk: number;
  /** The most constrained autonomy default across its workflows. */
  tightestAutonomy: string;
  /** How the sector compares with the catalogue as a whole. */
  vsAll: { risk: number; reliability: number };
  /**
   * Set when the tag rests on too few workflows to carry a comparison. Two or
   * three tagged workflows is a hint, not a sector profile, and the panel says
   * which it is looking at.
   */
  thin: string | null;
}

const ALL_TAGGED = USE_CASES.filter((u) => (u.industries ?? []).length > 0);

function meanRiskOf(ws: UseCase[]): number {
  return ws.length
    ? ws.reduce((a, u) => a + RISK_SCORE[u.riskTier], 0) / ws.length
    : 0;
}

function meanReliabilityOf(ws: UseCase[]): number {
  const withBar = ws.filter((u) => typeof u.reliabilityRequirement === "number");
  return withBar.length
    ? withBar.reduce((a, u) => a + (u.reliabilityRequirement as number), 0) /
        withBar.length
    : 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The assurance profile of one vertical, or null when the catalogue carries
 * nothing tagged to it.
 *
 * Returns null rather than falling back to the catalogue average, because an
 * average presented as a sector reading is the failure this whole panel exists
 * to avoid: it would look like a fact about banking and be a fact about
 * everything.
 */
export function verticalLens(tag: IndustryTag | null): VerticalLens | null {
  if (!tag) return null;
  const ws = USE_CASES.filter((u) => (u.industries ?? []).includes(tag));
  if (ws.length === 0) return null;

  const risk = meanRiskOf(ws);
  const reliability = meanReliabilityOf(ws);
  const tightest = ws
    .map((u) => u.autonomyDefault)
    .sort((a, b) => (AUTONOMY_RANK[a] ?? 9) - (AUTONOMY_RANK[b] ?? 9))[0];

  return {
    tag,
    workflows: ws.length,
    meanRisk: round1(risk),
    meanReliability: round1(reliability),
    highRisk: ws.filter((u) => u.riskTier === "high" || u.riskTier === "critical")
      .length,
    tightestAutonomy: tightest ?? "human_in_loop",
    vsAll: {
      risk: round1(risk - meanRiskOf(ALL_TAGGED)),
      reliability: round1(reliability - meanReliabilityOf(ALL_TAGGED)),
    },
    thin:
      ws.length < 4
        ? `${ws.length} of the ${USE_CASES.length} catalogued workflows are tagged to this sector, which is a hint at its assurance bar rather than a profile of it`
        : null,
  };
}

/** Every tag the catalogue actually carries workflows for. */
export function taggedIndustries(): IndustryTag[] {
  return [...new Set(ALL_TAGGED.flatMap((u) => u.industries ?? []))].sort();
}

/** Plain English for the autonomy defaults, which are stored as identifiers. */
export const AUTONOMY_LABEL: Record<string, string> = {
  advisory_only: "advisory only",
  human_in_loop: "human in the loop",
  supervised_agent: "supervised agent",
};

/** Readable sector names, since the tags are stored as identifiers. */
export const TAG_LABEL: Record<string, string> = {
  financial_services: "Financial services",
  healthcare: "Healthcare",
  pharma_life_sciences: "Pharma and life sciences",
  legal: "Legal",
  professional_services: "Professional services",
  technology_software: "Technology and software",
  manufacturing: "Manufacturing",
  retail_consumer: "Retail and consumer",
  telecom_media: "Telecoms and media",
  public_sector: "Public sector",
  education: "Education",
  energy_utilities: "Energy and utilities",
  transport_logistics: "Transport and logistics",
  insurance: "Insurance",
  real_estate: "Real estate",
};
