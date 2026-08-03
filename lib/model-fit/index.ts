// Workforce Model Fit — data layer and loader.
//
// The three JSON files under data/ are the integration package's bundled
// snapshot, copied verbatim on 2 August 2026 from ~/Downloads/pkg/01_data:
//
//   models.json                330 models, priced, with the benchmark axes that
//                              have been ingested. INTEGRATION.md section 5 says
//                              to wire this to the live price/performance
//                              catalogue instead; the snapshot ships first so the
//                              engine can be checked against its reference.
//   roles.json                 258 roles across 29 industries, 18 requirements
//                              each. Static by design and correct to ship as data.
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
}));

/** Industries in the library, cross-industry first, then alphabetical. */
export const INDUSTRIES: string[] = [
  CROSS_INDUSTRY,
  ...Array.from(new Set(ROLE_INDEX.map((r) => r.industry)))
    .filter((i) => i !== CROSS_INDUSTRY)
    .sort((a, b) => a.localeCompare(b)),
];

export function industryLabel(industry: string): string {
  return industry === CROSS_INDUSTRY ? CROSS_INDUSTRY_LABEL : industry;
}

/** Functions available inside one industry, alphabetical. */
export function functionsFor(industry: string): string[] {
  return Array.from(
    new Set(ROLE_INDEX.filter((r) => r.industry === industry).map((r) => r.function))
  ).sort((a, b) => a.localeCompare(b));
}

export function rolesFor(industry: string, fn: string): RoleSummary[] {
  return ROLE_INDEX.filter((r) => r.industry === industry && r.function === fn).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function roleById(id: string): Role | undefined {
  const r = ROLES[id];
  return r ? { ...r, role_id: r.role_id ?? id } : undefined;
}
