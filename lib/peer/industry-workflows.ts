import { USE_CASES, type UseCase } from "@/lib/aie";
import type { IndustryTag } from "@/lib/aie/use-cases";

// What firms in an industry actually run AI for.
//
// Peer Insights already answers "which vendors show up in my slice" from the
// uptake model. This answers the question a reader asks immediately after,
// which nothing in the product currently does: what are firms like mine
// using AI FOR. The workflow library has carried the answer since it was
// ported: every entry is tagged with the industries it is common in, but
// the library has only ever been read in one direction, workflow to vendors,
// on Workflow Shortlist. This is the reverse lookup.
//
// What these are, stated plainly because it matters: a curated taxonomy of
// enterprise AI workflows, not a log of observed deployments. Saying
// "contract review is common in legal" is an editorial claim about the
// market, defensible and useful, and it is not the same kind of thing as
// "Bank X deployed vendor Y", which this product does not have and does not
// invent. The panel says so on screen.

/**
 * The uptake API's nine segments mapped to the workflow library's industry
 * tags.
 *
 * An editorial mapping, declared here in full rather than inferred, because
 * the two vocabularies were built for different purposes and the joins are
 * judgement calls. Two segments legitimately cover more than one tag:
 * "Healthcare / life sciences" spans both healthcare delivery and pharma, and
 * "Education / research / media" spans education and media. Splitting them
 * would misrepresent what the reader selected; merging them silently would
 * hide that the slice is broader than its label.
 */
export const SEGMENT_TO_INDUSTRY: Record<string, IndustryTag[]> = {
  "Technology / software": ["technology_software"],
  "Financial services": ["financial_services", "insurance"],
  Legal: ["legal"],
  "Professional services / consulting": ["professional_services"],
  "Healthcare / life sciences": ["healthcare", "pharma_life_sciences"],
  "Manufacturing / industrials": ["manufacturing", "energy_utilities"],
  "Retail / consumer / ecommerce": ["retail_consumer", "transport_logistics"],
  "Public sector / government": ["public_sector"],
  "Education / research / media": ["education", "telecom_media"],
};

/** Why each multi-tag mapping is the shape it is, shown in the drawer. */
export const MAPPING_NOTES: Record<string, string> = {
  "Financial services":
    "Includes insurance: the uptake engine treats them as one segment, and their AI workflows overlap heavily on claims, underwriting and fraud.",
  "Healthcare / life sciences":
    "Spans care delivery and pharma. Their workflows differ sharply: clinical documentation against drug discovery, so both sets are shown rather than one standing in for the other.",
  "Manufacturing / industrials":
    "Includes energy and utilities, which the uptake engine does not separate and which share predictive-maintenance and asset-monitoring workflows.",
  "Retail / consumer / ecommerce":
    "Includes transport and logistics, adjacent through demand forecasting and supply-chain planning.",
  "Education / research / media":
    "Spans education and media, grouped upstream. Their workflows have little in common, so the industry tag on each row is worth reading.",
};

export interface IndustryWorkflow {
  id: string;
  label: string;
  description: string;
  category: string;
  subcategory: string | null;
  riskTier: UseCase["riskTier"];
  reliabilityRequirement: number;
  autonomyDefault: UseCase["autonomyDefault"];
  complexity: string | null;
  regulatoryFlags: string[];
  commonInputs: string[];
  /** True when the workflow is tagged to this industry specifically. */
  industrySpecific: boolean;
}

function toRow(u: UseCase, industrySpecific: boolean): IndustryWorkflow {
  return {
    id: u.id,
    label: u.label,
    description: u.description ?? "",
    category: u.category,
    subcategory: u.subcategory ?? null,
    riskTier: u.riskTier,
    reliabilityRequirement: u.reliabilityRequirement,
    autonomyDefault: u.autonomyDefault,
    complexity: u.complexity ?? null,
    regulatoryFlags: u.regulatoryFlags ?? [],
    commonInputs: u.commonInputs ?? [],
    industrySpecific,
  };
}

export interface IndustryWorkflowSet {
  segment: string | null;
  /** Tagged to this industry specifically. The answer to "what is different here". */
  specific: IndustryWorkflow[];
  /** Run across every industry. Common ground, not filler. */
  horizontal: IndustryWorkflow[];
  /** The tags the segment mapped to, so the reader can see the join. */
  tags: IndustryTag[];
  mappingNote: string | null;
}

/**
 * Workflows for one uptake segment, split into industry-specific and
 * horizontal.
 *
 * The split is the point. A reader in legal wants to know what is different
 * about legal, and burying contract review among forty workflows every
 * industry runs would lose it. Horizontal workflows are still shown, because
 * "most of what you will run is what everyone runs" is itself a true and
 * useful finding, but they are shown second and labelled.
 *
 * Passing no segment returns every workflow as horizontal, which is the
 * honest reading of "all industries".
 */
export function workflowsForSegment(segment: string): IndustryWorkflowSet {
  const tags = SEGMENT_TO_INDUSTRY[segment] ?? [];
  const specific: IndustryWorkflow[] = [];
  const horizontal: IndustryWorkflow[] = [];

  for (const u of USE_CASES) {
    const inds = u.industries;
    // No tag at all, or an explicitly empty list, both mean "runs anywhere".
    // The v1 records predate the field and are horizontal by the same logic.
    if (!inds || inds.length === 0) {
      horizontal.push(toRow(u, false));
      continue;
    }
    if (tags.some((t) => inds.includes(t))) specific.push(toRow(u, true));
  }

  // Riskiest first: a reader scanning their industry's workflows is better
  // served meeting the ones that need the most control at the top.
  const byRisk = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const order = (a: IndustryWorkflow, b: IndustryWorkflow) =>
    byRisk[a.riskTier] - byRisk[b.riskTier] || a.label.localeCompare(b.label);
  specific.sort(order);
  horizontal.sort(order);

  return {
    segment: segment || null,
    specific,
    horizontal,
    tags,
    mappingNote: MAPPING_NOTES[segment] ?? null,
  };
}

/** Total workflows in the library, so the copy can state it rather than guess. */
export const WORKFLOW_LIBRARY_SIZE = USE_CASES.length;
