// Carrying a Decision Desk outcome into ModelEngine's three selectors.
//
// THE TWO VOCABULARIES. The workflow catalogue places a company in one of
// fifteen sector tags (`financial_services`, `healthcare` ...). The role
// library keys on its own thirty-seven industries ("Banking", "Insurance",
// "Healthcare Providers" ...). They were built for different jobs and neither
// is wrong, but nothing joined them, so a reader who had established their
// sector on Your AI Position still had to find it again in a thirty-seven item
// dropdown on ModelEngine.
//
// One tag maps to SEVERAL industries, and that is the honest shape rather than
// a limitation: `financial_services` covers retail banking, investment
// banking, payments and asset management, and picking one of those for the
// reader would be a guess. The first is offered as the default and the rest
// are handed over as alternatives the interface can show.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not pick a role. A function
// narrows the list from 297 roles to a handful, which is the work worth doing;
// choosing between "Architect" and "Structural Engineer" is the reader's
// decision and the one thing they definitely know better than we do.
//
// Pure data and pure functions. No fs, no network, safe from either side.

import type { PositionOpportunities } from "./opportunities";

/**
 * Sector tag to role-library industries, best default first.
 *
 * Hand-written because the two lists were authored independently and no
 * mechanical join exists: "Healthcare Providers" and "Pharmaceuticals" are
 * both healthcare-adjacent and only one of them is what `healthcare` means.
 */
export const SECTOR_TO_INDUSTRIES: Record<string, string[]> = {
  financial_services: [
    "Banking",
    "Investment Banking & Capital Markets",
    "Payments & FinTech",
    "Wealth & Asset Management",
  ],
  insurance: ["Insurance"],
  healthcare: ["Healthcare Providers", "Medical Devices"],
  pharma_life_sciences: ["Pharmaceuticals", "Biotechnology"],
  legal: ["Legal Services"],
  professional_services: [
    "Management Consulting",
    "Accounting & Audit",
    "IT Services & Consulting",
  ],
  technology_software: [
    "Software & SaaS",
    "Cloud & Digital Infrastructure",
    "Gaming & Interactive Entertainment",
  ],
  manufacturing: [
    "Manufacturing",
    "Automotive",
    "Aerospace & Defence",
    "Consumer Goods",
  ],
  retail_consumer: ["Retail & E-commerce", "Consumer Goods"],
  telecom_media: ["Telecommunications", "Media & Entertainment"],
  public_sector: ["Public Sector & Government"],
  education: ["Education", "Higher Education & Research"],
  energy_utilities: [
    "Power & Utilities",
    "Oil & Gas",
    "Renewable Energy",
    "Mining & Metals",
  ],
  transport_logistics: [
    "Transport & Logistics",
    "Airlines & Aviation",
    "Travel, Hospitality & Leisure",
  ],
  real_estate: ["Real Estate & Property Services", "Construction & Engineering"],
};

/**
 * Workflow category to role-library function.
 *
 * The workflow catalogue groups by what the work is about ("Customer",
 * "Engineering", "Legal"); the role library groups by the function a person
 * sits in. Where a category has no clean counterpart the entry is absent, and
 * the handoff then preselects the industry only rather than guessing a
 * function and narrowing the reader to the wrong shortlist.
 */
export const CATEGORY_TO_FUNCTION: Record<string, string> = {
  Customer: "Customer Operations & Service",
  Revenue: "Commercial, Sales & Business Development",
  Engineering: "Software Engineering & Product Development",
  IT: "Technology & IT",
  HR: "People & Human Resources",
  Legal: "Legal",
  Finance: "Finance",
  "Financial Services": "Risk & Compliance",
  Health: "Operations & Service Delivery",
  "Public Sector": "Operations & Service Delivery",
  "Critical Infrastructure": "Operations & Service Delivery",
  Education: "Operations & Service Delivery",
  Operations: "Operations & Service Delivery",
  Manufacturing: "Operations & Service Delivery",
  Data: "Data, Analytics & AI",
  Productivity: "Workplace, Facilities & Physical Security",
  Marketing: "Marketing & Communications",
  Procurement: "Procurement & Supplier Management",
  "Supply Chain": "Supply Chain & Logistics",
  Security: "Cybersecurity & Information Security",
  Risk: "Risk & Compliance",
};

export interface ModelEngineHandoff {
  /** The industry to preselect. */
  industry: string;
  /** The other industries this sector covers, for the interface to offer. */
  alternatives: string[];
  /** The function to preselect, where the lead area maps to one. */
  fn: string | null;
  /** The area the function came from, so the page can say why. */
  fromArea: string | null;
  /** Whether the sector mapped at all. */
  matched: boolean;
}

/**
 * What ModelEngine should open on, given what the Decision Desk established.
 *
 * Returns null when there is nothing to carry. A page that preselects on a
 * guess is worse than one that asks, because the reader cannot see it guessed.
 */
export function modelEngineHandoff(
  opp: PositionOpportunities | null
): ModelEngineHandoff | null {
  if (!opp) return null;
  const industries = SECTOR_TO_INDUSTRIES[opp.sectorTag];
  if (!industries || industries.length === 0) return null;

  // The function comes from the highest-ranked area that maps to one, not
  // simply the first area: an area whose category has no counterpart should
  // fall through to the next rather than clearing the function entirely.
  let fn: string | null = null;
  let fromArea: string | null = null;
  for (const a of opp.lead.length > 0 ? opp.lead : opp.areas) {
    const mapped = CATEGORY_TO_FUNCTION[a.category];
    if (mapped) {
      fn = mapped;
      fromArea = a.label;
      break;
    }
  }

  return {
    industry: industries[0],
    alternatives: industries.slice(1),
    fn,
    fromArea,
    matched: true,
  };
}
