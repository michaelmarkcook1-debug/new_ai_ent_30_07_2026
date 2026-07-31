import { USE_CASES, type UseCase, type IndustryTag } from "@/lib/aie/use-cases";

// Model allocation and the industry-and-role recommendation.
//
// Two different things live here and they must not be confused, so they are
// kept apart deliberately:
//
//   1. The ALLOCATION SPLIT is an assumption. Nothing in this product measures
//      what share of an enterprise's work is routine against complex. The
//      defaults below are illustrative, configurable, and labelled as such
//      wherever they render. They are not badged as derived, because they are
//      not derived from anything.
//
//   2. The ROLE RECOMMENDATION is derived. It reads the real workflow library:
//      each entry carries a risk tier, a complexity and regulatory flags, and
//      the recommended tier follows from those by a stated rule.
//
// The tempting mistake was to compute the split from the workflow library, on
// the grounds that 42 of 75 entries are "complex". That would be a category
// error: the library is a catalogue of workflow types, not a measure of how
// much work an enterprise does of each kind. A catalogue over-samples the
// interesting cases. The real distribution is still shown, because it is
// genuinely informative, but labelled as what it is: share of catalogued
// workflows, not share of work volume.

export type ModelTier = "frontier" | "mid" | "low";

export interface AllocationBand {
  tier: ModelTier;
  label: string;
  /** Illustrative default, adjustable. Never presented as measured. */
  percent: number;
  work: string;
}

/**
 * Illustrative default split. Adjust by industry and role.
 *
 * Not 10/80/10: that leaves no room for the routine tail, and the point of the
 * band is that most work does not need a frontier model. Any of these can be
 * overridden by the caller.
 */
export const DEFAULT_ALLOCATION: AllocationBand[] = [
  {
    tier: "frontier",
    label: "Frontier models",
    percent: 10,
    work: "Complex reasoning, strategic decisions, high-risk and regulated tasks",
  },
  {
    tier: "mid",
    label: "Mid-tier models",
    percent: 75,
    work: "Mainstream knowledge work and operational support",
  },
  {
    tier: "low",
    label: "Low-cost models and automation",
    percent: 15,
    work: "Routine, repetitive and low-risk workflows",
  },
];

export function normaliseAllocation(bands: AllocationBand[]): AllocationBand[] {
  const total = bands.reduce((a, b) => a + b.percent, 0);
  if (total === 100 || total === 0) return bands;
  return bands.map((b) => ({
    ...b,
    percent: Math.round((b.percent / total) * 100),
  }));
}

/**
 * What share of the catalogued workflows sit at each complexity.
 *
 * Real, and clearly not the same quantity as the allocation above. Shown next
 * to it so a reader can see the assumption and the measurement side by side
 * rather than mistaking one for the other.
 */
export function catalogueComplexityMix(): {
  complex: number;
  moderate: number;
  simple: number;
  counted: number;
  total: number;
} {
  const withComplexity = USE_CASES.filter((u) => u.complexity);
  const count = (c: string) =>
    withComplexity.filter((u) => u.complexity === c).length;
  const counted = withComplexity.length;
  const pct = (n: number) => (counted ? Math.round((n / counted) * 100) : 0);
  return {
    complex: pct(count("complex")),
    moderate: pct(count("moderate")),
    simple: pct(count("simple")),
    counted,
    total: USE_CASES.length,
  };
}

// ------------------------------------------------- industry and role mapping

export const INDUSTRY_LABEL: Record<string, string> = {
  financial_services: "Financial services",
  healthcare: "Healthcare",
  pharma_life_sciences: "Pharma and life sciences",
  legal: "Legal",
  professional_services: "Professional services",
  technology_software: "Technology and software",
  manufacturing: "Manufacturing",
  retail_consumer: "Retail and consumer",
  telecom_media: "Telecom and media",
  public_sector: "Public sector",
  education: "Education",
  energy_utilities: "Energy and utilities",
  transport_logistics: "Transport and logistics",
  insurance: "Insurance",
  real_estate: "Real estate",
};

export interface RoleRecommendation {
  workflowId: string;
  workflowLabel: string;
  industry: string;
  industryLabel: string;
  category: string;
  tier: ModelTier;
  tierLabel: string;
  why: string;
  escalateFor: string[];
  impact: string;
  riskTier: string;
  complexity: string;
  regulatoryFlags: string[];
  /** Rule that produced the tier, shown in the evidence drawer. */
  rule: string;
}

const TIER_LABEL: Record<ModelTier, string> = {
  frontier: "Frontier model",
  mid: "Mid-tier enterprise model",
  low: "Low-cost model or automation",
};

/**
 * Recommended tier for one workflow, from the fields the library publishes.
 *
 * The rule is stated rather than tuned: risk dominates complexity, because
 * getting a critical-risk task wrong costs more than the inference saved.
 */
function tierFor(uc: UseCase): { tier: ModelTier; rule: string } {
  const risk = uc.riskTier;
  const complexity = uc.complexity ?? "moderate";

  if (risk === "critical") {
    return {
      tier: "frontier",
      rule: "Critical risk tier: frontier regardless of complexity, because the cost of a wrong answer exceeds any inference saving.",
    };
  }
  if (complexity === "complex" && (risk === "high" || risk === "medium")) {
    return {
      tier: "frontier",
      rule: "Complex work at high or medium risk: frontier reasoning is doing real work here.",
    };
  }
  if (complexity === "simple" && risk === "low") {
    return {
      tier: "low",
      rule: "Simple work at low risk: a low-cost model or ordinary automation covers this.",
    };
  }
  return {
    tier: "mid",
    rule: "Moderate complexity or contained risk: a mid-tier enterprise model is the value choice.",
  };
}

export function industriesWithWorkflows(): string[] {
  const seen = new Set<string>();
  for (const u of USE_CASES) for (const i of u.industries ?? []) seen.add(i);
  return [...seen].sort((a, b) =>
    (INDUSTRY_LABEL[a] ?? a).localeCompare(INDUSTRY_LABEL[b] ?? b)
  );
}

export function workflowsForIndustry(industry: string): UseCase[] {
  return USE_CASES.filter((u) =>
    (u.industries ?? []).includes(industry as IndustryTag)
  );
}

export function recommendFor(
  industry: string,
  workflowId?: string
): RoleRecommendation | null {
  const pool = workflowsForIndustry(industry);
  if (pool.length === 0) return null;

  const uc = (workflowId && pool.find((u) => u.id === workflowId)) || pool[0];
  const { tier, rule } = tierFor(uc);
  const flags = uc.regulatoryFlags ?? [];

  // What would push this workflow up a tier. Derived from the same fields, so
  // it stays consistent with the rule above rather than being written prose.
  const escalate: string[] = [];
  if (tier !== "frontier") {
    escalate.push("Cases where a wrong answer carries legal or financial exposure");
    if (flags.length) escalate.push(`Anything touching ${flags.slice(0, 3).join(", ")}`);
    escalate.push("Disputes, exceptions and high-value accounts");
  } else {
    escalate.push("Already at the top tier for this workflow");
  }

  const impact =
    tier === "frontier"
      ? "Frontier pricing is justified here. Look for savings in the surrounding routine steps instead."
      : tier === "mid"
        ? "Lower inference cost than frontier without materially reducing quality on this class of work."
        : "Lowest cost per task. Reserve human review for the exceptions rather than the volume.";

  return {
    workflowId: uc.id,
    workflowLabel: uc.label,
    industry,
    industryLabel: INDUSTRY_LABEL[industry] ?? industry,
    category: uc.category,
    tier,
    tierLabel: TIER_LABEL[tier],
    why: `${uc.label} is catalogued as ${uc.complexity ?? "moderate"} complexity at ${uc.riskTier} risk${flags.length ? `, carrying ${flags.length} regulatory ${flags.length === 1 ? "flag" : "flags"}` : ""}.`,
    escalateFor: escalate,
    impact,
    riskTier: uc.riskTier,
    complexity: uc.complexity ?? "not recorded",
    regulatoryFlags: flags,
    rule,
  };
}
