// Workforce Model Fit: data layer and loader.
//
// The three JSON files under data/ are the integration package's bundled
// snapshot, copied verbatim on 2 August 2026 from ~/Downloads/pkg/01_data:
//
//   models.json                330 models, priced, with the benchmark axes that
//                              have been ingested. INTEGRATION.md section 5 says
//                              to wire this to the live price/performance
//                              catalogue instead; the snapshot ships first so the
//                              engine can be checked against its reference.
//   roles.json                 the role library, 18 requirements each. Static by
//                              design and correct to ship as data. Counts are not
//                              written here: LIBRARY_ROLE_COUNT and
//                              LIBRARY_INDUSTRY_COUNT below derive them, because a
//                              number in a comment goes stale the first time the
//                              file grows and nobody notices.
//   axes-and-calibration.json  requirement-to-axis map and the provisional
//                              thresholds.
//
// What is real and what is not, stated here because the interface states it on
// every screen and integration must not lose it:
//
//   REAL        model prices, throughput and intelligence index; factual
//               reliability, graduate reasoning and agentic Elo where published.
//   JUDGEMENT   every role requirement profile, and every capability threshold.
//   ASSUMPTION  reasoning token burn multipliers, headcount defaults, and the
//               output price ratios used where a vendor publishes no output price.

import modelsJson from "./data/models.json";
import rolesJson from "./data/roles.json";
import axesJson from "./data/axes-and-calibration.json";
import sourcesJson from "./data/sources.json";
import { Engine, type CalibrationTable, type EngineOptions, type ModelRecord, type Role } from "./engine";

export * from "./engine";
export { RUBRIC, type RubricEntry } from "./rubric";

export interface AxisRecord {
  axis: string;
  status: string;
  source?: string;
  note?: string;
}

export const MODELS = modelsJson as ModelRecord[];
export const ROLES = rolesJson as unknown as Record<string, Role>;
export const CALIBRATION = (axesJson as unknown as { calibration: CalibrationTable })
  .calibration;
export const CAPABILITY_NAMES = (axesJson as { capability_names: Record<string, string> })
  .capability_names;
export const AXES = (axesJson as unknown as { axes: Record<string, AxisRecord> }).axes;
export const SOURCES = sourcesJson as {
  benchmarks: string;
  catalogue: string;
  note: string;
};

/** Every requirement id in rubric order, whether or not it has an axis. */
export const CAP_IDS = Object.keys(CAPABILITY_NAMES);

export function loadEngine(opts: EngineOptions = {}): Engine {
  return new Engine(MODELS, CALIBRATION, CAPABILITY_NAMES, opts);
}

// ---------------------------------------------------------------------------
// Role library indexes for the selectors
// ---------------------------------------------------------------------------

/**
 * Cross-industry roles carry "*" as their industry: one profile serves every
 * sector. That is wrong and the specification says so (join_specification
 * section 6), but it is not yet fixable from evidence, so it is labelled
 * rather than hidden.
 */
export const CROSS_INDUSTRY = "*";
export const CROSS_INDUSTRY_LABEL = "Cross-industry (all sectors)";

export interface RoleSummary {
  role_id: string;
  name: string;
  industry: string;
  function: string;
  seniority?: string;
  authority?: string;
  headcount?: number;
  /** Duty profiles are held for every role but only computed on failure. */
  duties: number;
  /** True when this role is filed once and applies to every sector. */
  crossIndustry: boolean;
}

export const ROLE_INDEX: RoleSummary[] = Object.entries(ROLES).map(([id, r]) => ({
  role_id: id,
  name: r.name ?? id,
  industry: r.industry ?? CROSS_INDUSTRY,
  function: r.function ?? "Unassigned",
  seniority: r.seniority,
  authority: r.authority,
  headcount: r.headcount,
  duties: r.duties?.length ?? 0,
  crossIndustry: (r.industry ?? CROSS_INDUSTRY) === CROSS_INDUSTRY,
}));

/** Industries in the library, cross-industry first, then alphabetical. */
export const INDUSTRIES: string[] = [
  CROSS_INDUSTRY,
  ...Array.from(new Set(ROLE_INDEX.map((r) => r.industry)))
    .filter((i) => i !== CROSS_INDUSTRY)
    .sort((a, b) => a.localeCompare(b)),
];

/**
 * The 36 industries gathered into nine macro sectors.
 *
 * A flat alphabetical list of 36 puts Banking next to Biotechnology and
 * Automotive next to Banking, which is an ordering nobody thinks in. The
 * grouping is a presentation layer only: the engine never sees it, and a role's
 * `industry` field is untouched.
 *
 * The taxonomy publishes no sector level of its own, so these groupings are
 * ours and are the obvious reading rather than a standard classification. They
 * are not SIC or NAICS and should not be cited as either.
 */
export interface IndustryGroup {
  macro: string;
  industries: string[];
}

const GROUPING: IndustryGroup[] = [
  {
    macro: "Financial services",
    industries: [
      "Banking",
      "Insurance",
      "Investment Banking & Capital Markets",
      "Payments & FinTech",
      "Wealth & Asset Management",
    ],
  },
  {
    macro: "Health & life sciences",
    industries: [
      "Biotechnology",
      "Healthcare Providers",
      "Medical Devices",
      "Pharmaceuticals",
    ],
  },
  {
    macro: "Technology, media & telecoms",
    industries: [
      "Cloud & Digital Infrastructure",
      "Gaming & Interactive Entertainment",
      "IT Services & Consulting",
      "Media & Entertainment",
      "Software & SaaS",
      "Telecommunications",
    ],
  },
  {
    macro: "Manufacturing & industrials",
    industries: [
      "Aerospace & Defence",
      "Automotive",
      "Construction & Engineering",
      "Manufacturing",
    ],
  },
  {
    macro: "Energy, utilities & resources",
    industries: ["Mining & Metals", "Oil & Gas", "Power & Utilities", "Renewable Energy"],
  },
  {
    macro: "Consumer & retail",
    industries: [
      "Agriculture & Food Production",
      "Consumer Goods",
      "Retail & E-commerce",
      "Travel, Hospitality & Leisure",
    ],
  },
  {
    macro: "Transport & mobility",
    industries: ["Airlines & Aviation", "Transport & Logistics"],
  },
  {
    macro: "Professional services",
    industries: [
      "Accounting & Audit",
      "Legal Services",
      "Management Consulting",
      "Real Estate & Property Services",
    ],
  },
  {
    macro: "Public sector & education",
    industries: ["Education", "Higher Education & Research", "Public Sector & Government"],
  },
];

/**
 * The grouping as the menu should render it, with two guarantees enforced here
 * rather than trusted: every industry in the library appears exactly once, and
 * nothing appears that the library does not have.
 *
 * An industry added to the data and forgotten here would otherwise vanish from
 * the menu while its roles stayed in the library, which is the failure mode
 * this whole feature exists to fix.
 */
export const INDUSTRY_GROUPS: IndustryGroup[] = (() => {
  const known = new Set(INDUSTRIES.filter((i) => i !== CROSS_INDUSTRY));
  const placed = new Set<string>();
  const groups: IndustryGroup[] = [];
  for (const g of GROUPING) {
    const industries = g.industries.filter((i) => {
      if (!known.has(i)) return false; // named here, absent from the data
      placed.add(i);
      return true;
    });
    if (industries.length) groups.push({ macro: g.macro, industries });
  }
  const orphans = [...known].filter((i) => !placed.has(i)).sort((a, b) => a.localeCompare(b));
  if (orphans.length) {
    // Shown, not swallowed. A new industry appears under a visible heading that
    // says it has not been sorted yet.
    groups.push({ macro: "Not yet grouped", industries: orphans });
  }
  return groups;
})();

/**
 * The library's size, derived rather than written down.
 *
 * Two user-facing strings quoted "258 roles across 29 industries" for weeks
 * after the library grew to 294 across 36: the counts were literals in copy,
 * and adding roles did not touch them. Anything that states a size now reads
 * these.
 */
export const LIBRARY_ROLE_COUNT = ROLE_INDEX.length;
export const LIBRARY_INDUSTRY_COUNT = INDUSTRY_GROUPS.reduce(
  (n, g) => n + g.industries.length,
  0
);

export function industryLabel(industry: string): string {
  return industry === CROSS_INDUSTRY ? CROSS_INDUSTRY_LABEL : industry;
}

/**
 * Cross-industry roles are not a category a buyer picks: they are roles that
 * exist in every sector. A bank employs a Financial Controller and a Chief
 * Information Officer just as a hospital does, and the library files them once
 * rather than once per industry.
 *
 * So choosing an industry has to return that industry's specialist roles AND
 * the 99 common ones. Filtering on `industry === chosen` alone hides 99 of the
 * 105 roles a bank actually has, which reads as a library with nothing in it.
 */
function specificTo(industry: string): RoleSummary[] {
  return ROLE_INDEX.filter((r) => r.industry === industry);
}

function commonTo(industry: string): RoleSummary[] {
  return industry === CROSS_INDUSTRY
    ? []
    : ROLE_INDEX.filter((r) => r.industry === CROSS_INDUSTRY);
}

/** Functions available inside one industry, specialist and common, alphabetical. */
export function functionsFor(industry: string): string[] {
  if (!industry) return [];
  return Array.from(
    new Set([...specificTo(industry), ...commonTo(industry)].map((r) => r.function))
  ).sort((a, b) => a.localeCompare(b));
}

/**
 * Functions split into the ones this industry adds and the ones every industry
 * has, so the menu can group them instead of running 23 together in one list.
 *
 * A function named by both counts as specific: it is the industry's own version
 * of the work, and listing it twice would suggest two different choices.
 */
export function functionGroups(industry: string): { specific: string[]; common: string[] } {
  const specific = new Set(specificTo(industry).map((r) => r.function));
  const common = new Set(
    commonTo(industry)
      .map((r) => r.function)
      .filter((f) => !specific.has(f))
  );
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { specific: sort(specific), common: sort(common) };
}

/** How the choice divides, for the caption under the menu. */
export function functionCounts(industry: string): { specific: number; common: number } {
  const g = functionGroups(industry);
  return { specific: g.specific.length, common: g.common.length };
}

/**
 * The eighteen cross-industry functions, gathered the way the industries are.
 *
 * Eighteen in one alphabetical run puts Finance between Executive Leadership
 * and Internal Audit, which is not how anyone looks for a function. As with the
 * sectors, this is a presentation layer of ours: the taxonomy publishes no
 * function grouping and the engine never sees one.
 *
 * Industry-specific functions are not grouped. There are only five to seven of
 * them in any one industry and they already share a heading that says what they
 * are.
 */
const FUNCTION_GROUPING: { macro: string; functions: string[] }[] = [
  {
    macro: "Leadership & strategy",
    functions: [
      "Executive Leadership & Corporate Strategy",
      "Transformation, Projects & Change",
    ],
  },
  {
    macro: "Finance, risk & legal",
    functions: ["Finance", "Internal Audit", "Legal", "Risk & Compliance"],
  },
  {
    macro: "Technology & data",
    functions: [
      "Cybersecurity & Information Security",
      "Data, Analytics & AI",
      "Software Engineering & Product Development",
      "Technology & IT",
    ],
  },
  {
    macro: "Commercial & customer",
    functions: [
      "Commercial, Sales & Business Development",
      "Customer Operations & Service",
      "Marketing & Communications",
    ],
  },
  {
    macro: "Operations & supply chain",
    functions: [
      "Operations & Service Delivery",
      "Procurement & Supplier Management",
      "Supply Chain & Logistics",
    ],
  },
  {
    macro: "People & workplace",
    functions: ["People & Human Resources", "Workplace, Facilities & Physical Security"],
  },
];

export interface FunctionMenuGroup {
  macro: string;
  functions: string[];
  /** True for the industry's own functions, which are not macro-grouped. */
  specificToIndustry?: boolean;
}

/**
 * The Function menu as it should render for one industry: the industry's own
 * functions under a heading of their own, then the common eighteen under their
 * macro headings.
 *
 * Same guard as the sectors, for the same reason. Every function reachable in
 * this industry appears exactly once, and anything the grouping has not placed
 * gets a visible heading rather than dropping out of the menu.
 */
export function functionMenu(industry: string): FunctionMenuGroup[] {
  if (!industry) return [];
  const { specific, common } = functionGroups(industry);
  const out: FunctionMenuGroup[] = [];
  if (specific.length && industry !== CROSS_INDUSTRY) {
    out.push({ macro: `Specific to ${industry}`, functions: specific, specificToIndustry: true });
  }
  // Under cross-industry the "specific" set IS the common eighteen, so it takes
  // the macro grouping rather than a heading naming an industry.
  const pool = new Set(industry === CROSS_INDUSTRY ? specific : common);
  const placed = new Set<string>();
  for (const g of FUNCTION_GROUPING) {
    const fns = g.functions.filter((f) => {
      if (!pool.has(f)) return false;
      placed.add(f);
      return true;
    });
    if (fns.length) out.push({ macro: g.macro, functions: fns });
  }
  const orphans = [...pool].filter((f) => !placed.has(f)).sort((a, b) => a.localeCompare(b));
  if (orphans.length) out.push({ macro: "Not yet grouped", functions: orphans });
  return out;
}

/**
 * Roles in one industry and function. Specialist roles first, then the common
 * ones, each carrying `crossIndustry` so the interface can say which is which
 * rather than blending two different claims into one list.
 */
export function rolesFor(industry: string, fn: string): RoleSummary[] {
  if (!industry || !fn) return [];
  const by = (a: RoleSummary, b: RoleSummary) => a.name.localeCompare(b.name);
  return [
    ...specificTo(industry)
      .filter((r) => r.function === fn)
      .sort(by),
    ...commonTo(industry)
      .filter((r) => r.function === fn)
      .sort(by),
  ];
}

export function roleById(id: string): Role | undefined {
  const r = ROLES[id];
  return r ? { ...r, role_id: r.role_id ?? id } : undefined;
}
